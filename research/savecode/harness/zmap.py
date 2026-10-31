"""Map every character of a `z` save code back to the part of the save it encodes.
Inflates the DEFLATE stream by hand, recording for each symbol the compressed bits it occupies
and the JSON bytes it produced; each JSON byte has a path (record > field)."""
import base64, json, sys, collections

code = open(sys.argv[1]).read().strip()
assert code[0] == 'z'
body = code[1:]
data = base64.urlsafe_b64decode(body + '=' * (-len(body) % 4))

# ---------------------------------------------------------------- inflate with provenance
class Bits:
    def __init__(s, d): s.d, s.pos = d, 0
    def bit(s):
        b = (s.d[s.pos >> 3] >> (s.pos & 7)) & 1; s.pos += 1; return b
    def bits(s, n):
        v = 0
        for i in range(n): v |= s.bit() << i
        return v

def huff(lengths):
    # canonical Huffman: returns dict (len, code) -> symbol
    mx = max(lengths) if lengths else 0
    bl = collections.Counter(l for l in lengths if l)
    code, nxt = 0, {}
    for b in range(1, mx + 1):
        code = (code + bl.get(b - 1, 0)) << 1 if b > 1 else 0
        nxt[b] = code
    t = {}
    for sym, l in enumerate(lengths):
        if l: t[(l, nxt[l])] = sym; nxt[l] += 1
    return t

def decode(br, t):
    code = 0
    for l in range(1, 16):
        code = (code << 1) | br.bit()
        if (l, code) in t: return t[(l, code)]
    raise ValueError('bad code')

LBASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258]
LEXT = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0]
DBASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577]
DEXT = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13]

br = Bits(data)
out = bytearray()
spans = []  # (bit_start, bit_end, kind, out_start, out_end)
while True:
    s0 = br.pos
    final = br.bit(); btype = br.bits(2)
    if btype == 0: raise SystemExit('stored block not handled')
    if btype == 1:
        lit = huff([8]*144 + [9]*112 + [7]*24 + [8]*8); dist = huff([5]*30)
    else:
        hlit, hdist, hclen = br.bits(5) + 257, br.bits(5) + 1, br.bits(4) + 4
        order = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]
        cl = [0]*19
        for i in range(hclen): cl[order[i]] = br.bits(3)
        ct = huff(cl); lens = []
        while len(lens) < hlit + hdist:
            sym = decode(br, ct)
            if sym < 16: lens.append(sym)
            elif sym == 16: lens += [lens[-1]] * (3 + br.bits(2))
            elif sym == 17: lens += [0] * (3 + br.bits(3))
            else: lens += [0] * (11 + br.bits(7))
        lit = huff(lens[:hlit]); dist = huff(lens[hlit:])
    spans.append((s0, br.pos, 'table', len(out), len(out)))
    while True:
        a = br.pos
        sym = decode(br, lit)
        if sym < 256:
            out.append(sym); spans.append((a, br.pos, 'literal', len(out) - 1, len(out)))
        elif sym == 256:
            spans.append((a, br.pos, 'end', len(out), len(out))); break
        else:
            i = sym - 257; ln = LBASE[i] + br.bits(LEXT[i])
            d = decode(br, dist); dd = DBASE[d] + br.bits(DEXT[d])
            st = len(out)
            for k in range(ln): out.append(out[-dd])
            spans.append((a, br.pos, 'copy', st, len(out)))
    if final: break

text = out.decode()
doc = json.loads(text)

# ---------------------------------------------------------------- JSON byte -> path
path_of = [None] * len(out)
def scan():
    # tiny scanner tracking a key path; labels each byte with the path of the value it sits in
    i, stack, key = 0, [], None
    pending = None
    def label(a, b, p):
        for k in range(a, b): path_of[k] = p
    raw = out
    n = len(raw)
    pathstack = [[]]
    expect_key = [False]
    cur_key = [None]
    while i < n:
        c = chr(raw[i])
        p = pathstack[-1] + ([cur_key[-1]] if cur_key[-1] is not None else [])
        if c == '{':
            path_of[i] = tuple(p); pathstack.append(p); expect_key.append(True); cur_key.append(None); i += 1
        elif c == '[':
            path_of[i] = tuple(p); pathstack.append(p); expect_key.append(False); cur_key.append(None); i += 1
        elif c in '}]':
            pathstack.pop(); expect_key.pop(); cur_key.pop(); path_of[i] = tuple(pathstack[-1] + ([cur_key[-1]] if cur_key[-1] is not None else [])); i += 1
        elif c == '"':
            j = i + 1
            while chr(raw[j]) != '"':
                j += 2 if chr(raw[j]) == '\\' else 1
            s = raw[i+1:j].decode()
            if expect_key[-1]:
                cur_key[-1] = s; label(i, j + 1, tuple(pathstack[-1] + [s]))
            else:
                label(i, j + 1, tuple(p))
            i = j + 1
        elif c == ':':
            path_of[i] = tuple(p); expect_key[-1] = False; i += 1
        elif c == ',':
            path_of[i] = tuple(p)
            if len(expect_key) > 1 and isinstance(cur_key[-1], str): expect_key[-1] = True
            i += 1
        else:
            path_of[i] = tuple(p); i += 1
scan()

def name(p):
    if not p: return 'envelope'
    if p[0] != 'data': return 'envelope: ' + '.'.join(p)
    if len(p) == 1: return 'data (structure)'
    rec = p[1]
    if len(p) == 2: return rec + ' (structure)'
    return rec + ' › ' + '.'.join(p[2:4])

# ---------------------------------------------------------------- compressed bit -> label
nbits = len(data) * 8
bitlab = ['padding'] * nbits
for a, b, kind, oa, ob in spans:
    if kind == 'table': lab = 'DEFLATE header + Huffman tables'
    elif kind == 'end': lab = 'DEFLATE end-of-block'
    else:
        c = collections.Counter(name(path_of[k]) for k in range(oa, ob))
        lab = c.most_common(1)[0][0]
    for k in range(a, b): bitlab[k] = lab

# base64 char i covers stream bits [6i, 6i+6) MSB-first within bytes; DEFLATE numbers bits LSB-first
chars = []
for i, ch in enumerate(body):
    c = collections.Counter()
    for p in range(6 * i, 6 * i + 6):
        byte, msb = divmod(p, 8)
        if byte >= len(data): continue
        c[bitlab[byte * 8 + (7 - msb)]] += 1
    chars.append((ch, c.most_common(1)[0][0] if c else 'padding'))

chunks = []
for i, (ch, lab) in enumerate(chars):
    if chunks and chunks[-1][2] == lab: chunks[-1][1] = i; chunks[-1][3] += ch
    else: chunks.append([i, i, lab, ch])

json.dump({'chunks': [{'from': a + 2, 'to': b + 2, 'label': l, 'chars': s} for a, b, l, s in chunks],
           'by_label': collections.Counter(l for _, l in chars).most_common(),
           'by_record': collections.Counter(l.split(' ›')[0].split(' (')[0] for _, l in chars).most_common(),
           'spans': collections.Counter(k for *_, k, _, _ in [(0,0,s[2],0,0) for s in spans]).most_common()},
          open(sys.argv[2], 'w'), indent=1)
print('chars', len(body), 'chunks', len(chunks), 'json ok', len(text))
