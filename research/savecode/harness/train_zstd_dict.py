"""Round 3 (throwaway): train a zstd dictionary on a directory of sample payloads.
usage: python3 train_zstd_dict.py <samples-dir> <dict-size> <out-file>
Falls back to a raw-content dictionary (the samples concatenated, most recent last) when
ZDICT training refuses the sample set; both kinds load as a zstd dictionary and as a DEFLATE
preset dictionary."""
import os, sys
import zstandard as zstd

d, size, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
samples = [open(os.path.join(d, f), 'rb').read() for f in sorted(os.listdir(d), key=lambda x: int(x.split('.')[0]))]
try:
    data = zstd.train_dictionary(size, samples, level=19).as_bytes()
    kind = 'zdict'
except zstd.ZstdError:
    blob = b''.join(samples)
    data = blob[-size:]
    kind = 'raw'
open(out, 'wb').write(data)
print(kind, len(data))
