# The sample `z` save code, character by character

The sample code is `research/savecode/sample/sample-save-code.txt`: 2,941 characters, `z` + base64url of DEFLATE-compressed JSON (11,819 bytes). It is synthetic: the 9 Classic files are placeholders for the planned B-L design.

**How the map was made** (`harness/zmap.py`, MEASURED):

- The DEFLATE stream was decompressed by hand, recording for each compressed symbol the bits it occupies and the JSON bytes it produced.
- A symbol is either one literal character or a "copy N bytes from earlier" back-reference.
- Each JSON byte is labelled with the record and field it belongs to.
- Each code character (6 bits) gets the label of the bits it mostly carries.

**Caveats:**

- A character can straddle two fields, because 6-bit characters do not line up with symbol boundaries.
- A back-reference is credited to the field it rebuilds, even though it reuses text from an earlier field.

Positions count the `z` as character 1.

## Record map

| Characters | Count | What it encodes |
| --- | --- | --- |
| 1 | 1 | `z`: the format marker (deflate-compressed text) |
| 2–86 | 85 | DEFLATE header + Huffman tables |
| 87–88 | 2 | envelope |
| 89–105 | 17 | envelope: app |
| 106–112 | 7 | envelope: v |
| 113–134 | 22 | envelope: exported |
| 135–142 | 8 | data |
| 143–1593 | 1451 | smbc.settings |
| 1594–1704 | 111 | smbc.progress |
| 1705–2086 | 382 | smbc.save.1 |
| 2087–2168 | 82 | smbc.save.2 |
| 2169–2236 | 68 | smbc.save.3 |
| 2237–2489 | 253 | smbc-classic-file-smb-1 |
| 2490–2548 | 59 | smbc-classic-file-smb-2 |
| 2549–2609 | 61 | smbc-classic-file-smb-3 |
| 2610–2668 | 59 | smbc-classic-file-special-1 |
| 2669–2721 | 53 | smbc-classic-file-special-2 |
| 2722–2776 | 55 | smbc-classic-file-special-3 |
| 2777–2833 | 57 | smbc-classic-file-lost-1 |
| 2834–2885 | 52 | smbc-classic-file-lost-2 |
| 2886–2936 | 51 | smbc-classic-file-lost-3 |
| 2937–2937 | 1 | data |
| 2938–2938 | 1 | envelope |
| 2939–2940 | 2 | DEFLATE end-of-block |
| 2941–2941 | 1 | padding |

## Every chunk

Each row is a run of consecutive characters that encode the same field. The value column is that field's decoded content.


### DEFLATE header + Huffman tables

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2–86 | `7VlZj9s4Ev4vfB05sA67bb_1kWtzTBAnmMUGe…` | DEFLATE header + Huffman tables |  |

### envelope

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 87–88 | `Ad` | (structure: braces, keys, commas) |  |

### envelope: app

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 89–105 | `Cq4osiC5X6UhByXYk` | envelope: app |  |

### envelope: v

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 106–112 | `IBuyCAM` | envelope: v |  |

### envelope: exported

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 113–134 | `Cu0oqAxlZkGgcTUfheBRFJ` | envelope: exported |  |

### data

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 135–142 | `CAZNZQsH` | (structure: braces, keys, commas) |  |

### smbc.settings

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 143–154 | `myXVxqMYWKtE` | (structure: braces, keys, commas) |  |
| 155–160 | `diQRRy` | v | `3` |
| 161–168 | `QDctA4iM` | video | `{"integerScale":true,"palette":"default","reduceFlashing":false,"sh…` |
| 169–184 | `TBtaglinlQBZG1RC` | video.integerScale | `true` |
| 185–201 | `QinIwBsiCZJDTmhsS` | video.palette | `"default"` |
| 202–222 | `EAVZncIbTnXBxJoscso1B` | video.reduceFlashing | `false` |
| 223–233 | `EQXcvum0s3z` | video.showFps | `false` |
| 234–234 | `I` | video | `{"integerScale":true,"palette":"default","reduceFlashing":false,"sh…` |
| 235–241 | `SC0zpgd` | audio | `{"master":0.4,"music":1,"sfx":1,"muted":false}` |
| 242–253 | `uKTagCKL8ask` | audio.master | `0.4` |
| 254–261 | `IGWtWWrX` | audio.music | `1` |
| 262–266 | `q_Od_` | audio.sfx | `1` |
| 267–267 | `V` | audio.muted | `false` |
| 268–268 | `_` | audio.sfx | `1` |
| 269–274 | `WdtFtN` | audio.muted | `false` |
| 275–281 | `yaq2mC3` | input | `{"bindings":[{"keyboard":{"left":["ArrowLeft","KeyA"],"right":["Arr…` |
| 282–676 | `FROZW-qPB3IP-5WkKkMDh9yQxQ9yrZTcfsSHg…` | input.bindings | `[{"keyboard":{"left":["ArrowLeft","KeyA"],"right":["ArrowRight","Ke…` |
| 677–688 | `iZJ0WZEFobSR` | input.touch | `"auto"` |
| 689–696 | `pHpsoFwY` | input.touchScale | `1` |
| 697–708 | `ks14jOdtBRgI` | input.dpad | `"fixed"` |
| 709–717 | `kyzsmjB_H` | input.keyHints | `false` |
| 718–724 | `tGbaRiT` | assist | `{"allowLeftScroll":false,"infiniteLives":false,"invulnerable":false…` |
| 725–737 | `KuQs4y1RJzrvQ` | assist.allowLeftScroll | `false` |
| 738–752 | `x0TOBDPwkW1Ae-i` | assist.infiniteLives | `false` |
| 753–761 | `m5gIUXeFM` | assist.invulnerable | `false` |
| 762–769 | `R02_sbIH` | assist.infiniteTime | `false` |
| 770–782 | `U7mXBt4oWmL3c` | assist.coyoteFrames | `0` |
| 783–783 | `U` | assist.fireRevertsToBig | `false` |
| 784–784 | `B` | assist.coyoteFrames | `0` |
| 785–801 | `ypuArbEAZ_U3eMC_I` | assist.fireRevertsToBig | `false` |
| 802–813 | `0hzM_g2XUvUY` | assist.safetyFloor | `false` |
| 814–824 | `l9tP0jApyCI` | assist.slowMotion | `1` |
| 825–825 | `8` | assist | `{"allowLeftScroll":false,"infiniteLives":false,"invulnerable":false…` |
| 826–836 | `oPPSewya6HU` | packs | `[]` |
| 837–844 | `hZC3SLpx` | announce | `true` |
| 845–849 | `nsOm6` | dev | `false` |
| 850–861 | `ZbD5LrjEQyEk` | devUnlock | `""` |
| 862–878 | `ICua3tfVVyiZyED1u` | backupReminders | `false` |
| 879–890 | `yhkCctUAQj0g` | homeScreen | `{"tipDone":false,"noticeDone":false,"offlineDone":false}` |
| 891–898 | `GHVnRT9y` | homeScreen.tipDone | `false` |
| 899–905 | `oU0LIUB` | homeScreen.noticeDone | `false` |
| 906–913 | `JPOcM-Fj` | homeScreen.offlineDone | `false` |
| 914–916 | `h4C` | homeScreen | `{"tipDone":false,"noticeDone":false,"offlineDone":false}` |
| 917–930 | `kHL2Yfq057rB9J` | classicRules | `"classic"` |
| 931–953 | `J3hE63uWJ6ztOZmTxakwOva` | classicMapDifficulty | `"hard"` |
| 954–962 | `WW8LoMamL` | classicCheats | `{"on":{"allGroundIsBricks":false,"allHammerBros":false,"allWeaponsP…` |
| 963–1126 | `Cmac3irZC2y9_pGMbvbZnLK-TtalqBulBygfw…` | classicCheats.on | `{"allGroundIsBricks":false,"allHammerBros":false,"allWeaponsPierce"…` |
| 1127–1158 | `dWWIpD9XdzueHzS60OTc7rDHvu8xf-OL` | classicCheats.unlocked | `{"allGroundIsBricks":false,"allHammerBros":false,"allWeaponsPierce"…` |
| 1159–1234 | `temITsIKBnoO8iBWok0DlrMbqOBqCplrSAbtF…` | classicCheats.stats | `{"enemiesDefeated":0,"enemiesStomped":0,"armouredDefeated":0,"brick…` |
| 1235–1261 | `rLC76KRkK3vuqjdbIRLjJFow-su` | classicCheats.beaten | `{"smb":true,"special":false,"lost":true}` |
| 1262–1272 | `hWGiBv1dN2N` | classicCheats.continuesUsed | `0` |
| 1273–1281 | `z2ABfNrH7` | classicCheats.levelSelect | `false` |
| 1282–1286 | `KCrYn` | classic | `{"lives":3,"whenHit":"lose-everything","attack":"normal","drops":"n…` |
| 1287–1287 | `O` | classic.lives | `3` |
| 1288–1288 | `W` | classic | `{"lives":3,"whenHit":"lose-everything","attack":"normal","drops":"n…` |
| 1289–1292 | `8Fwd` | classic.lives | `3` |
| 1293–1312 | `kW4B4xwxZ4JAwsmdnrNL` | classic.whenHit | `"lose-everything"` |
| 1313–1322 | `sswgRUmE2D` | classic.attack | `"normal"` |
| 1323–1330 | `UimJG6oB` | classic.drops | `"normal"` |
| 1331–1342 | `9BB-2UFVgd3a` | classic.enemySpeed | `"normal"` |
| 1343–1356 | `MUUFQXFllqWqN_` | classic.piranhas | `"some"` |
| 1357–1366 | `WUpYrC8g8J` | classic.goombas | `"off"` |
| 1367–1376 | `y51uHNA3pJ` | classic.gameMode | `"all"` |
| 1377–1392 | `GqC4BF5IWFBOu1We` | classic.musicSet | `"character"` |
| 1393–1402 | `wq6jQNtg2P` | classic.expansion | `"off"` |
| 1403–1558 | `beO41ayUo0j2kMd6YIBxyi2Ypy_YQr9Q8p1Ay…` | classic.weapons | `{"bass":"water-shield","billFirst":"mg","billSecond":"spread","link…` |
| 1559–1566 | `v153WEWe` | classicDev | `{"yoshiMount":false,"heroesOff":[]}` |
| 1567–1581 | `SB7qQv2SdbC9MkC` | classicDev.yoshiMount | `false` |
| 1582–1590 | `lAT9e57bf` | classicDev.heroesOff | `[]` |
| 1591–1591 | `I` | (structure: braces, keys, commas) |  |
| 1592–1592 | `x` | classicDev.heroesOff | `[]` |
| 1593–1593 | `c` | (structure: braces, keys, commas) |  |

### smbc.progress

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 1594–1606 | `xpqjUnKtQLc1R` | (structure: braces, keys, commas) |  |
| 1607–1607 | `4` | bestScore | `987650` |
| 1608–1608 | `i` | v | `1` |
| 1609–1626 | `M0maZSgVkMZ9dTSdIE` | bestScore | `987650` |
| 1627–1637 | `KrNbefnhfMG` | lastCharacter | `"link"` |
| 1638–1645 | `Fhs0LWz4` | reached | `{}` |
| 1646–1656 | `sfMDVfiAuc0` | cleared | `[]` |
| 1657–1660 | `R7oF` | lost | `{"world9":true,"letters":false,"beaten":2}` |
| 1661–1669 | `speLZvKWl` | lost.world9 | `true` |
| 1670–1674 | `LVe89` | lost.letters | `false` |
| 1675–1675 | `N` | lost.beaten | `2` |
| 1676–1676 | `V` | lost.letters | `false` |
| 1677–1678 | `yN` | lost.beaten | `2` |
| 1679–1685 | `-qXfwPU` | classicBeat | `{"smb":"hard","special":"none","lost":"normal"}` |
| 1686–1692 | `dGRuM01` | classicBeat.smb | `"hard"` |
| 1693–1698 | `HZyIwc` | classicBeat.special | `"none"` |
| 1699–1704 | `bXDtwz` | classicBeat.lost | `"normal"` |

### smbc.save.1

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 1705–1713 | `q9qLpBl6F` | (structure: braces, keys, commas) |  |
| 1714–1717 | `zU4S` | v | `4` |
| 1718–1724 | `m3yN3VK` | slot | `1` |
| 1725–1744 | `qmhsTXs2jaXSVjOfz8QT` | created | `1792627409905` |
| 1745–1749 | `VVHYS` | updated | `1792627409905` |
| 1750–1760 | `T729llQxVCY` | character | `"mario"` |
| 1761–1766 | `dFjnxE` | character2 | `null` |
| 1767–1772 | `rTXAid` | lives | `4` |
| 1773–1781 | `y7gqjOEF3` | score | `123450` |
| 1782–1789 | `pZIh5eKr` | coins | `37` |
| 1790–1805 | `gFRyC2ppqC3TdOnY` | powerState | `"small"` |
| 1806–1810 | `W1T22` | hp | `0` |
| 1811–1816 | `t0zu9U` | kit | `{"found":1}` |
| 1817–1822 | `co3ajD` | kit.found | `1` |
| 1823–1829 | `rrW0aB5` | powerState2 | `"small"` |
| 1830–1832 | `1La` | hp2 | `0` |
| 1833–1833 | `P` | kit2 | `{}` |
| 1834–1850 | `jn1NwhFKuXAU2k-re` | cleared | `["1-0","1-1","1-2"]` |
| 1851–1865 | `Cu6xnX9QKeMQqfL` | pages | `["smb-1"]` |
| 1866–1872 | `UgWm0R2` | secrets | `[]` |
| 1873–1880 | `V1MwJkgf` | position | `{"page":"smb-1","node":"start"}` |
| 1881–1888 | `b1BWsdgD` | position.page | `"smb-1"` |
| 1889–1894 | `h7pgTd` | position.node | `"start"` |
| 1895–1905 | `o1ku23namMJ` | gameCleared | `false` |
| 1906–1913 | `1eazbYcr` | lastNode | `{}` |
| 1914–1925 | `qcDWgaiHrEr8` | pendingReveal | `[]` |
| 1926–1933 | `6WmXay_d` | devUnlockAll | `false` |
| 1934–1945 | `ZrC55vydpaAP` | devAllHeroes | `false` |
| 1946–1956 | `vqUGfq-gT8G` | devGateOpen | `false` |
| 1957–1966 | `5Arcx53dUi` | freed | `["mario"]` |
| 1967–1976 | `LWRilGuB2g` | tutorials | `["mario"]` |
| 1977–1981 | `JZvDM` | met | `["mario"]` |
| 1982–1996 | `xAaEkWr_vUuKXdo` | inventoryUnlocked | `false` |
| 1997–2004 | `StXZzOBp` | bonusOpen | `true` |
| 2005–2014 | `a4G1tiw7vb` | bonusGuard | `false` |
| 2015–2021 | `rxvR3A7` | heroInventory | `{}` |
| 2022–2033 | `s5CBUn-GnXGQ` | heroItemsNext | `{}` |
| 2034–2038 | `7egex` | bonusNext | `0` |
| 2039–2048 | `8hKmsGNq13` | spadeBoard | `0` |
| 2049–2056 | `ax2_UhvT` | spadeTaken | `[]` |
| 2057–2064 | `GDd6I3jw` | devInventory | `false` |
| 2065–2070 | `fbALF8` | heroKits | `{}` |
| 2071–2078 | `baUczBea` | wallet | `false` |
| 2079–2086 | `qs4ZcLdo` | explained | `[]` |

### smbc.save.2

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2087–2090 | `QGno` | (structure: braces, keys, commas) |  |
| 2091–2094 | `2NOR` | slot | `2` |
| 2095–2098 | `2c4P` | created | `1792627409906` |
| 2099–2104 | `T3D6em` | updated | `1792627409906` |
| 2105–2109 | `Q0839` | character | `"link"` |
| 2110–2113 | `PUvp` | character2 | `null` |
| 2114–2114 | `S` | lives | `5` |
| 2115–2122 | `UfpKJnOx` | score | `246900` |
| 2123–2126 | `x6lZ` | coins | `38` |
| 2127–2132 | `0eUzuu` | powerState | `"full"` |
| 2133–2136 | `O0dP` | hp | `6` |
| 2137–2146 | `_EaPxM7afy` | cleared | `["1-0","1-1","1-2","1-3","1-4"]` |
| 2147–2150 | `VNjd` | devUnlockAll | `false` |
| 2151–2153 | `5NX` | freed | `["mario","link"]` |
| 2154–2158 | `jkneg` | tutorials | `["link"]` |
| 2159–2164 | `gOO922` | met | `["mario","link"]` |
| 2165–2168 | `fNNX` | inventoryUnlocked | `false` |

### smbc.save.3

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2169–2169 | `j` | (structure: braces, keys, commas) |  |
| 2170–2173 | `Y6rH` | slot | `3` |
| 2174–2177 | `f43q` | created | `1792627409906` |
| 2178–2180 | `bar` | character | `"megaman"` |
| 2181–2184 | `-Bdu` | character2 | `null` |
| 2185–2185 | `n` | lives | `6` |
| 2186–2193 | `Hdvjq3Hs` | score | `370350` |
| 2194–2197 | `B_D5` | coins | `39` |
| 2198–2200 | `ebZ` | powerState | `"full"` |
| 2201–2202 | `Hs` | hp | `28` |
| 2203–2212 | `_8D3QMSWTx` | cleared | `["1-0","1-1","1-2","1-3","1-4","2-1","2-2"]` |
| 2213–2217 | `6eoG9` | devUnlockAll | `false` |
| 2218–2220 | `F1G` | freed | `["mario","megaman"]` |
| 2221–2225 | `PQnyP` | tutorials | `["megaman"]` |
| 2226–2230 | `H10Az` | met | `["mario","megaman"]` |
| 2231–2231 | `_` | inventoryUnlocked | `false` |
| 2232–2232 | `J` | met | `["mario","megaman"]` |
| 2233–2236 | `E78C` | inventoryUnlocked | `false` |

### smbc-classic-file-smb-1

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2237–2248 | `okUGjnHEYudP` | (structure: braces, keys, commas) |  |
| 2249–2252 | `rhJm` | v | `1` |
| 2253–2262 | `V6e9RlsaWJ` | levelId | `"3-2"` |
| 2263–2268 | `zi6J1A` | hero | `"mario"` |
| 2269–2273 | `aDjeS` | score | `87650` |
| 2274–2280 | `raFwGAe` | coins | `13` |
| 2281–2282 | `ef` | lives | `3` |
| 2283–2289 | `B-QecXW` | powerState | `"big"` |
| 2290–2293 | `DZfj` | hp | `3` |
| 2294–2296 | `jsq` | kit | `{"tier":1,"ammo":21}` |
| 2297–2301 | `G4aUJ` | kit.tier | `1` |
| 2302–2309 | `XUVCFlF4` | kit.ammo | `21` |
| 2310–2313 | `GGyi` | heroKits | `{"mario":{"powerState":"big","hp":3,"kit":{"tier":0}},"luigi":{"pow…` |
| 2314–2325 | `mQv5ddlIY9Rm` | heroKits.mario | `{"powerState":"big","hp":3,"kit":{"tier":0}}` |
| 2326–2341 | `vGZr9qgTvkY5N7_t` | heroKits.luigi | `{"powerState":"fire","hp":3,"kit":{"tier":1}}` |
| 2342–2352 | `ZRX3xTNFVgU` | heroKits.link | `{"powerState":"big","hp":3,"kit":{"tier":2}}` |
| 2353–2361 | `6TX35TPHB` | heroKits.samus | `{"powerState":"fire","hp":3,"kit":{"tier":3}}` |
| 2362–2364 | `Sue` | heroKits | `{"mario":{"powerState":"big","hp":3,"kit":{"tier":0}},"luigi":{"pow…` |
| 2365–2369 | `unEQL` | checkpoint | `{"x":1216,"y":192}` |
| 2370–2377 | `vviOwmlA` | checkpoint.x | `1216` |
| 2378–2384 | `9mQRziO` | checkpoint.y | `192` |
| 2385–2389 | `_YrIn` | continues | `0` |
| 2390–2396 | `r9x7kge` | rules | `{"difficulty":"easy","gameMode":"allHeroes","more":{"lives":3,"atta…` |
| 2397–2405 | `S-S9FgOr9` | rules.difficulty | `"easy"` |
| 2406–2413 | `o0qluRYB` | rules.gameMode | `"allHeroes"` |
| 2414–2461 | `Ke3R-JVUVy1JxdZM2EKor648sC2iPMgrmDzUK…` | rules.more | `{"lives":3,"attack":"original","whenHit":"original","drops":"origin…` |
| 2462–2466 | `L4wOA` | rules.weapons | `{}` |
| 2467–2476 | `cmYxhdhHRP` | rules.disabled | `[]` |
| 2477–2489 | `pBrJr4-LquPkL` | savedAt | `1792000000001` |

### smbc-classic-file-smb-2

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2490–2493 | `z1I0` | (structure: braces, keys, commas) |  |
| 2494–2501 | `OkXRxAax` | levelId | `"4-3"` |
| 2502–2506 | `hqKOA` | hero | `"luigi"` |
| 2507–2513 | `b1OvprE` | score | `175300` |
| 2514–2518 | `nqgIE` | coins | `14` |
| 2519–2521 | `19L` | lives | `4` |
| 2522–2525 | `X3p0` | powerState | `"fire"` |
| 2526–2526 | `U` | kit.tier | `2` |
| 2527–2529 | `UfS` | kit.ammo | `22` |
| 2530–2533 | `6LmS` | heroKits.luigi | `{"powerState":"fire","hp":3,"kit":{"tier":1}}` |
| 2534–2536 | `NI7` | checkpoint.x | `1232` |
| 2537–2540 | `-JEm` | continues | `0` |
| 2541–2544 | `7kvv` | rules.difficulty | `"normal"` |
| 2545–2548 | `p0jQ` | rules.more | `{"lives":3,"attack":"original","whenHit":"original","drops":"origin…` |

### smbc-classic-file-smb-3

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2549–2553 | `6S9P4` | (structure: braces, keys, commas) |  |
| 2554–2560 | `FE0nNsu` | levelId | `"5-4"` |
| 2561–2565 | `2NHWy` | hero | `"link"` |
| 2566–2573 | `uJW-02ju` | score | `262950` |
| 2574–2577 | `R9KJ` | coins | `15` |
| 2578–2580 | `L48` | lives | `5` |
| 2581–2584 | `vpVZ` | powerState | `"big"` |
| 2585–2588 | `H0vi` | kit.ammo | `23` |
| 2589–2592 | `5kjS` | heroKits.luigi | `{"powerState":"fire","hp":3,"kit":{"tier":1}}` |
| 2593–2593 | `Z` | checkpoint.x | `1248` |
| 2594–2597 | `nSZp` | continues | `1` |
| 2598–2605 | `eI6kTdH_` | rules.difficulty | `"hard"` |
| 2606–2609 | `dCka` | rules.more | `{"lives":3,"attack":"original","whenHit":"original","drops":"origin…` |

### smbc-classic-file-special-1

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2610–2617 | `n6aoe8lx` | (structure: braces, keys, commas) |  |
| 2618–2626 | `OuHrahRbI` | levelId | `"sp-3-1"` |
| 2627–2627 | `d` | hero | `"samus"` |
| 2628–2628 | `c` | levelId | `"sp-3-1"` |
| 2629–2633 | `w1R1P` | hero | `"samus"` |
| 2634–2640 | `r1sn46k` | score | `350600` |
| 2641–2644 | `fUKe` | coins | `16` |
| 2645–2646 | `-t` | lives | `6` |
| 2647–2650 | `r2YK` | powerState | `"fire"` |
| 2651–2654 | `x1Xk` | kit.ammo | `24` |
| 2655–2658 | `-fK1` | heroKits.luigi | `{"powerState":"fire","hp":3,"kit":{"tier":1}}` |
| 2659–2661 | `Wny` | checkpoint.x | `1264` |
| 2662–2664 | `kvW` | rules.more | `{"lives":3,"attack":"original","whenHit":"original","drops":"origin…` |
| 2665–2668 | `HXE1` | savedAt | `1792000000004` |

### smbc-classic-file-special-2

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2669–2673 | `-ydXo` | (structure: braces, keys, commas) |  |
| 2674–2677 | `DFcT` | levelId | `"sp-4-2"` |
| 2678–2684 | `X5_aN5g` | hero | `"simon"` |
| 2685–2690 | `9V5N4F` | score | `438250` |
| 2691–2696 | `vlh9ar` | coins | `17` |
| 2697–2698 | `ja` | lives | `2` |
| 2699–2699 | `n` | powerState | `"big"` |
| 2700–2700 | `R` | lives | `2` |
| 2701–2702 | `xW` | powerState | `"big"` |
| 2703–2708 | `O1z_-S` | kit.ammo | `25` |
| 2709–2712 | `5UnU` | heroKits.luigi | `{"powerState":"fire","hp":3,"kit":{"tier":1}}` |
| 2713–2713 | `2` | checkpoint.x | `1280` |
| 2714–2717 | `fsn9` | rules.more | `{"lives":3,"attack":"original","whenHit":"original","drops":"origin…` |
| 2718–2721 | `x2Sd` | savedAt | `1792000000005` |

### smbc-classic-file-special-3

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2722–2726 | `_JKs8` | (structure: braces, keys, commas) |  |
| 2727–2730 | `RmyT` | levelId | `"sp-5-3"` |
| 2731–2737 | `nyl2r8u` | hero | `"megaman"` |
| 2738–2744 | `aOg6iSb` | score | `525900` |
| 2745–2749 | `-C7Bw` | coins | `18` |
| 2750–2753 | `drae` | powerState | `"fire"` |
| 2754–2757 | `-sUp` | hp | `3` |
| 2758–2761 | `9jJg` | kit.ammo | `26` |
| 2762–2765 | `-lz5` | heroKits.luigi | `{"powerState":"fire","hp":3,"kit":{"tier":1}}` |
| 2766–2768 | `Op-` | checkpoint.x | `1296` |
| 2769–2772 | `-yIA` | rules.more | `{"lives":3,"attack":"original","whenHit":"original","drops":"origin…` |
| 2773–2776 | `hW6c` | savedAt | `1792000000006` |

### smbc-classic-file-lost-1

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2777–2782 | `n2Yo_b` | (structure: braces, keys, commas) |  |
| 2783–2790 | `ZzWAJyPY` | levelId | `"ll-3-4"` |
| 2791–2798 | `l-trprfk` | hero | `"bill"` |
| 2799–2805 | `RxPp2E8` | score | `613550` |
| 2806–2809 | `8cPq` | coins | `19` |
| 2810–2813 | `_GxN` | powerState | `"big"` |
| 2814–2817 | `dUnd` | kit.tier | `1` |
| 2818–2818 | `f` | kit.ammo | `27` |
| 2819–2819 | `_` | heroKits.luigi | `{"powerState":"fire","hp":3,"kit":{"tier":1}}` |
| 2820–2820 | `V` | kit.ammo | `27` |
| 2821–2822 | `Ma` | heroKits.luigi | `{"powerState":"fire","hp":3,"kit":{"tier":1}}` |
| 2823–2823 | `R` | checkpoint.x | `1312` |
| 2824–2824 | `q` | heroKits.luigi | `{"powerState":"fire","hp":3,"kit":{"tier":1}}` |
| 2825–2826 | `H0` | checkpoint.x | `1312` |
| 2827–2829 | `YsC` | rules.more | `{"lives":3,"attack":"original","whenHit":"original","drops":"origin…` |
| 2830–2833 | `GNL0` | savedAt | `1792000000007` |

### smbc-classic-file-lost-2

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2834–2838 | `6jxNo` | (structure: braces, keys, commas) |  |
| 2839–2842 | `zM0T` | levelId | `"ll-4-1"` |
| 2843–2849 | `XypqvZ1` | hero | `"ryu"` |
| 2850–2856 | `z9KrcRh` | score | `701200` |
| 2857–2861 | `50TQa` | coins | `20` |
| 2862–2865 | `n62p` | powerState | `"fire"` |
| 2866–2869 | `Lqr8` | kit.tier | `2` |
| 2870–2870 | `Z` | kit.ammo | `28` |
| 2871–2874 | `8-Vp` | heroKits.luigi | `{"powerState":"fire","hp":3,"kit":{"tier":1}}` |
| 2875–2877 | `tHs` | checkpoint.x | `1328` |
| 2878–2880 | `Jfs` | rules.more | `{"lives":3,"attack":"original","whenHit":"original","drops":"origin…` |
| 2881–2885 | `fE3V2` | savedAt | `1792000000008` |

### smbc-classic-file-lost-3

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2886–2889 | `nqjx` | (structure: braces, keys, commas) |  |
| 2890–2893 | `GaJO` | levelId | `"ll-5-2"` |
| 2894–2901 | `BjrV_aje` | hero | `"sophia"` |
| 2902–2906 | `c3U2m` | score | `788850` |
| 2907–2912 | `3kRNQr` | coins | `21` |
| 2913–2916 | `PFlW` | powerState | `"big"` |
| 2917–2920 | `X1P_` | kit.tier | `0` |
| 2921–2921 | `z` | kit.ammo | `29` |
| 2922–2925 | `50rV` | heroKits.luigi | `{"powerState":"fire","hp":3,"kit":{"tier":1}}` |
| 2926–2926 | `J` | checkpoint.x | `1344` |
| 2927–2930 | `HlJ_` | rules.more | `{"lives":3,"attack":"original","whenHit":"original","drops":"origin…` |
| 2931–2934 | `EOiz` | savedAt | `1792000000009` |
| 2935–2936 | `g-` | (structure: braces, keys, commas) |  |

### data

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2937–2937 | `H` | (structure: braces, keys, commas) |  |

### envelope

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2938–2938 | `w` | (structure: braces, keys, commas) |  |

### DEFLATE end-of-block

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2939–2940 | `38` | DEFLATE end-of-block |  |

### padding

| Chars | Code text | Field | Value |
| --- | --- | --- | --- |
| 2941–2941 | `A` | padding |  |
