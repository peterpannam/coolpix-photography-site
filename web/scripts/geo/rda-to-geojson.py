"""Convert an sf data frame saved in an R .rda file to GeoJSON, with no R install.

Minimal reader for R serialization format version 2 (XDR), enough for sf data frames saved by save().
Used for the ABS LGA 2022 boundaries in the absmapsdata package (data/lga2022.rda); see the README.

Usage: python3 scripts/geo/rda-to-geojson.py <file.rda> <out.geojson> [object name]
The .rda may be bzip2, gzip or xz compressed (as R saves them) or already decompressed.
Writes every sf data frame row as a GeoJSON feature (MULTIPOLYGON/POLYGON geometries; other columns become properties).
"""
import bz2
import gzip
import json
import lzma
import struct
import sys

NILVALUE, REFSXP, EMPTYENV, BASEENV, GLOBALENV, UNBOUND, MISSINGARG, BASENS = 254, 255, 242, 241, 253, 252, 251, 250
PERSIST, PACKAGE, NAMESPACE = 247, 248, 249


class RObj:
    __slots__ = ('type', 'value', 'attr')

    def __init__(self, t, v, a=None):
        self.type, self.value, self.attr = t, v, a or {}

    def __repr__(self):
        return f'RObj({self.type}, {str(self.value)[:40]})'


class Reader:
    def __init__(self, data):
        self.d = data
        self.p = 0
        self.refs = []

    def i(self):
        v = struct.unpack_from('>i', self.d, self.p)[0]
        self.p += 4
        return v

    def length(self):
        n = self.i()
        if n == -1:
            hi, lo = self.i(), self.i()
            n = (hi << 32) + lo
        return n

    def attrs(self, pl):
        out = {}
        while pl is not None and isinstance(pl, RObj) and pl.type == 'pairlist':
            for tag, val in pl.value:
                out[tag] = val
            break
        return out

    def item(self):
        flags = self.i()
        t = flags & 0xFF
        has_attr = bool(flags & (1 << 9))
        has_tag = bool(flags & (1 << 10))
        if t == NILVALUE:
            return None
        if t in (EMPTYENV, BASEENV, GLOBALENV, UNBOUND, MISSINGARG, BASENS):
            return RObj('special', t)
        if t == REFSXP:
            idx = flags >> 8
            if idx == 0:
                idx = self.i()
            return self.refs[idx - 1]
        if t in (PERSIST, PACKAGE, NAMESPACE):
            self.i()  # 0
            n = self.i()
            strs = [self.item() for _ in range(n)]
            o = RObj('ns', strs)
            self.refs.append(o)
            return o
        if t == 1:  # SYMSXP
            o = RObj('sym', None)
            self.refs.append(o)
            o.value = self.item()
            return o
        if t == 4:  # ENVSXP
            o = RObj('env', None)
            self.refs.append(o)
            self.i()  # locked
            enclos, frame, hashtab, attr = self.item(), self.item(), self.item(), self.item()
            o.value = (frame, hashtab)
            return o
        if t in (2, 6, 17, 5, 3):  # LISTSXP, LANGSXP, DOTSXP, PROMSXP, CLOSXP: pairlist-like
            items = []
            attr = None
            while True:
                if has_attr:
                    attr = self.item()
                tag = self.item() if has_tag else None
                car = self.item()
                items.append((tag.value if isinstance(tag, RObj) and tag.type == 'sym' else tag, car))
                nflags = self.i()
                nt = nflags & 0xFF
                if nt in (2, 6, 17) and t == nt:
                    has_attr = bool(nflags & (1 << 9))
                    has_tag = bool(nflags & (1 << 10))
                    continue
                self.p -= 4
                cdr = self.item()
                if cdr is not None:
                    items.append((None, cdr))
                break
            return RObj('pairlist', items)
        if t == 9:  # CHARSXP
            n = self.i()
            if n == -1:
                return None
            s = self.d[self.p:self.p + n].decode('utf-8', 'replace')
            self.p += n
            return s
        if t in (10, 13):  # LGLSXP, INTSXP
            n = self.length()
            v = list(struct.unpack_from(f'>{n}i', self.d, self.p))
            self.p += 4 * n
            o = RObj('int', v)
        elif t == 14:  # REALSXP
            n = self.length()
            v = list(struct.unpack_from(f'>{n}d', self.d, self.p))
            self.p += 8 * n
            o = RObj('real', v)
        elif t == 15:  # CPLXSXP
            n = self.length()
            self.p += 16 * n
            o = RObj('cplx', None)
        elif t == 16:  # STRSXP
            n = self.length()
            o = RObj('str', [self.item() for _ in range(n)])
        elif t in (19, 20):  # VECSXP, EXPRSXP
            n = self.length()
            o = RObj('list', [self.item() for _ in range(n)])
        elif t == 24:  # RAWSXP
            n = self.length()
            o = RObj('raw', self.d[self.p:self.p + n])
            self.p += n
        elif t == 25:  # S4SXP
            o = RObj('s4', None)
        else:
            raise ValueError(f'unsupported SEXP type {t} at {self.p}')
        if has_attr:
            o.attr = self.attrs(self.item())
        return o


def decompress(data):
    if data[:3] == b'BZh':
        return bz2.decompress(data)
    if data[:2] == b'\x1f\x8b':
        return gzip.decompress(data)
    if data[:6] == b'\xfd7zXZ\x00':
        return lzma.decompress(data)
    return data


def read_rdata(path):
    data = decompress(open(path, 'rb').read())
    assert data[:5] == b'RDX2\n' and data[5:7] == b'X\n', 'expected RDX2 XDR'
    r = Reader(data)
    r.p = 7
    ver, _, _ = r.i(), r.i(), r.i()
    assert ver == 2, f'serialization version {ver} not supported'
    top = r.item()
    return {tag: val for tag, val in top.value}


def strings(o):
    return o.value if isinstance(o, RObj) and o.type == 'str' else None


def ring(m):
    n = m.attr['dim'].value[0]
    v = m.value
    return [[v[k], v[n + k]] for k in range(n)]


def geom(g):
    cls = strings(g.attr.get('class')) or []
    if 'MULTIPOLYGON' in cls:
        return {'type': 'MultiPolygon', 'coordinates': [[ring(r) for r in poly.value] for poly in g.value]}
    if 'POLYGON' in cls:
        return {'type': 'Polygon', 'coordinates': [ring(r) for r in g.value]}
    return None


def sf_to_geojson(df):
    names = strings(df.attr['names'])
    cols = dict(zip(names, df.value))
    gcol = strings(df.attr.get('sf_column'))[0]
    feats = []
    n = len(cols[gcol].value)
    for k in range(n):
        props = {}
        for name, col in cols.items():
            if name == gcol or not isinstance(col, RObj) or col.type not in ('str', 'int', 'real'):
                continue
            lv = strings(col.attr.get('levels'))
            val = col.value[k]
            if isinstance(val, float) and val != val:   # R NA_real_ / NaN
                val = None
            elif isinstance(val, int) and val == -2147483648:   # R NA_integer_
                val = None
            props[name] = lv[val - 1] if lv and isinstance(val, int) and val > 0 else val
        feats.append({'type': 'Feature', 'properties': props, 'geometry': geom(cols[gcol].value[k])})
    return {'type': 'FeatureCollection', 'features': feats}


if __name__ == '__main__':
    objs = read_rdata(sys.argv[1])
    name = sys.argv[3] if len(sys.argv) > 3 else next(iter(objs))
    fc = sf_to_geojson(objs[name])
    json.dump(fc, open(sys.argv[2], 'w'))
    print(name, len(fc['features']), 'features; props:', list(fc['features'][0]['properties'].keys()))
