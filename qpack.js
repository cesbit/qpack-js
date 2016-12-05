/*
 * QPack JavaScript (de)serializer.
 *
 * Author: Jeroen van der Heijden
 * Maintainer: jeroen@transceptor.technology
 * Date: 2016-12-02
 */

'use strict';

(function () {

    var QP_DOUBLE = 0xec;

    /*
     *  https://coolaj86.com/articles/
     *      unicode-string-to-a-utf-8-typed-array-buffer-in-javascript/
     */
    function extractUtf8 (ua, pos, end) {
        var c, arr = [];
        while (pos < end) {
            c = ua[pos++]; // lead byte
            arr.push(c < 0x80 ? c : // ASCII(0x00 ~ 0x7f)
                     c < 0xe0 ? ((c & 0x1f) <<  6 | (ua[pos++] & 0x3f)) :
                                ((c & 0x0f) << 12 | (ua[pos++] & 0x3f) << 6
                                                  | (ua[pos++] & 0x3f)));
        }
        if (pos > end) {
            throw new Error(
                'QPack unicode error found at position ' + pos.toString());
        }
        return String.fromCharCode.apply(null, arr);
    }

    function _encode (obj, arr) {
        var tmp, i, c, sign, exp, frac, low, high,
            type = typeof obj;

        if (obj === true) {
            arr.push(0xf9);
        } else if (obj === false) {
            arr.push(0xfa);
        } else if (obj === null) {
            arr.push(0xfb);
        } else if (type === 'string') {
            /* utf8 */
            tmp = [];
            for (i = 0; i < obj.length; i++) {
                c = obj.charCodeAt(i);
                if (c < 0x80) { // ASCII(0x00 ~ 0x7f)
                    tmp.push(c & 0x7f);
                } else if (c < 0x0800) {
                    tmp.push(((c >>>  6) & 0x1f) | 0xc0,
                             (c & 0x3f) | 0x80);
                } else if (c < 0x10000) {
                    tmp.push(((c >>> 12) & 0x0f) | 0xe0,
                             ((c >>>  6) & 0x3f) | 0x80,
                             (c & 0x3f) | 0x80);
                }
            }

            if (tmp.length < 0x64) {
                arr.push(0x80 + tmp.length);
            } else if (tmp.length < 0x100) {
                arr.push(
                    0xe4,
                    tmp.length);
            } else if (tmp.length < 0x10000) {
                arr.push(
                    0xe5,
                    tmp.length & 0xff,
                    (tmp.length >> 8) & 0xff);
            } else if (tmp.length < 0x100000000) {
                arr.push(
                    0xe6,
                    tmp.length & 0xff,
                    (tmp.length >> 8) & 0xff,
                    (tmp.length >> 16) & 0xff,
                    (tmp.length >> 24) & 0xff);
            } else if (tmp.length < 0x10000000000000000) {
                arr.push(
                    0xe7,
                    tmp.length & 0xff,
                    (tmp.length >> 8) & 0xff,
                    (tmp.length >> 16) & 0xff,
                    (tmp.length >> 24) & 0xff,
                    (tmp.length >> 32) & 0xff,
                    (tmp.length >> 40) & 0xff,
                    (tmp.length >> 48) & 0xff,
                    (tmp.length >> 56) & 0xff);
            } else {
                throw new Error(
                        'String or bytes too long: ' +
                        obj.byteLength.toString());
            }
            Array.prototype.push.apply(arr, tmp);
        } else if (type === 'number') {
            if (obj !== obj) {
                /*
                 * Pack isNaN
                 */
                arr.push(
                    QP_DOUBLE,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf8, 0x7f);
            } else if (obj === Infinity) {
                /*
                 * Pack positive Infinity
                 */
                arr.push(
                    QP_DOUBLE,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x7f);
            } else if (obj === -Infinity) {
                /*
                 * Pack nagative Infinity
                 */
                arr.push(
                    QP_DOUBLE,
                    0xec, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0xff);
            } else if (obj === (obj | 0)) {
                /*
                 * Pack integer type. Note that in JavaScript values like
                 * 1.0 are exactly the same as 1. There is no way to make
                 * a difference between these two.
                 */
                if (obj >= 0 && obj < 64) {
                    arr.push(obj);
                } else if (obj >= -60 && obj < 0) {
                    arr.push(63 - obj);
                } else if (obj > -0x80 && obj < 0x80) {
                    arr.push(0xe8, obj);
                } else if (obj > -0x8000 && obj < 0x8000) {
                    arr.push(
                        0xe9,
                        obj & 0xff,
                        (obj >> 8) & 0xff);
                } else if (obj > -0x80000000 && obj < 0x80000000) {
                    arr.push(
                        0xea,
                        obj & 0xff,
                        (obj >> 8) & 0xff,
                        (obj >> 16) & 0xff,
                        (obj >> 24) & 0xff);
                } else if ( obj > -0x8000000000000000 &&
                            obj < 0x8000000000000000) {
                    arr.push(
                        0xeb,
                        obj & 0xff,
                        (obj >> 8) & 0xff,
                        (obj >> 16) & 0xff,
                        (obj >> 24) & 0xff,
                        (obj >> 32) & 0xff,
                        (obj >> 40) & 0xff,
                        (obj >> 48) & 0xff,
                        (obj >> 56) & 0xff);
                } else {
                    throw new Error(
                        'Qpack got an overflow error while encoding: ' +
                        obj.toString());
                }
            } else {
                /*
                 * Pack double type
                 * http://javascript.g.hatena.ne.jp/edvakf/20101128/1291000731
                 */
                sign = obj < 0;
                if (sign) obj *= -1;

                // add offset 1023 to ensure positive
                // 0.6931471805599453 = Math.LN2;
                exp  = ((Math.log(obj) / 0.6931471805599453) + 1023) | 0;

                // shift 52 - (exp - 1023) bits to make integer part exactly
                // 53 bits, then throw away trash less than decimal point
                frac = obj * Math.pow(2, 52 + 1023 - exp);

                //  S+-Exp(11)--++-----------------Fraction(52bits)-----------------------+
                //  ||          ||                                                        |
                //  v+----------++--------------------------------------------------------+
                //  00000000|00000000|00000000|00000000|00000000|00000000|00000000|00000000
                //  6      5    55  4        4        3        2        1        8        0
                //  3      6    21  8        0        2        4        6
                //
                //  +----------high(32bits)-----------+ +----------low(32bits)------------+
                //  |                                 | |                                 |
                //  +---------------------------------+ +---------------------------------+
                //  3      2    21  1        8        0
                //  1      4    09  6
                low = frac & 0xffffffff;
                if (sign) exp |= 0x800;
                high = ((frac / 0x100000000) & 0xfffff) | (exp << 20);

                arr.push(QP_DOUBLE,
                    low & 0xff,
                    (low >> 8) & 0xff,
                    (low >> 16) & 0xff,
                    (low >> 24) & 0xff,
                    high & 0xff,
                    (high >> 8) & 0xff,
                    (high >> 16) & 0xff,
                    (high >> 24) & 0xff);
            }
        } else if (Array.isArray(obj)) {
            if (obj.length < 6) {
                arr.push(0xed + obj.length);
                obj.forEach(function (o) {
                    _encode(o, arr);
                });
            } else {
                arr.push(0xfc);
                obj.forEach(function (o) {
                    _encode(o, arr);
                });

                arr.push(0xfe);
            }
        } else if (type === 'object') {
            var keys = Object.keys(obj);

            if (keys.length < 6) {
                arr.push(0xf3 + keys.length);
                keys.forEach(function (key) {
                    _encode(key, arr);
                    _encode(obj[key], arr);
                });
            } else {
                arr.push(0xfd);
                keys.forEach(function (key) {
                    _encode(key, arr);
                    _encode(obj[key], arr);
                });

                arr.push(0xff);
            }
        } else {
            throw new Error('QPack cannot encode type: ' + type.toString());
        }
    }

    function _decode (unpacker) {
        var obj, arr, n, sign, exp, frac, pos, num,
            tp = unpacker.qp[unpacker.pos++];

        if (tp < 0x40) {
            return tp;
        }

        if (tp < 0x7c) {
            return 63 - tp;
        }

        if (tp === 0x7c) {
            return 0;   // reserverd for object hook.
        }

        if (tp < 0x80) {
            return tp - 126;
        }

        if (tp < 0xe4) {
            pos = unpacker.pos;
            unpacker.pos += tp - 128;
            return extractUtf8(unpacker.qp, pos, unpacker.pos);
        }

        switch (tp) {
            case 0xe4:
                pos = unpacker.pos + 1;
                unpacker.pos = pos + unpacker.qp[unpacker.pos];
                return extractUtf8(unpacker.qp, pos, unpacker.pos);
            case 0xe5:
                pos = unpacker.pos + 2;
                unpacker.pos =
                    pos +
                    unpacker.qp[unpacker.pos] +
                    (unpacker.qp[unpacker.pos + 1] << 8);
                return extractUtf8(unpacker.qp, pos, unpacker.pos);
            case 0xe6:
                pos = unpacker.pos + 4;
                unpacker.pos =
                    pos +
                    unpacker.qp[unpacker.pos] +
                    (unpacker.qp[unpacker.pos + 1] << 8) +
                    (unpacker.qp[unpacker.pos + 2] << 16) +
                    (unpacker.qp[unpacker.pos + 3] << 24);
                return extractUtf8(unpacker.qp, pos, unpacker.pos);
            case 0xe7:
                pos = unpacker.pos + 8;
                unpacker.pos =
                    pos +
                    unpacker.qp[unpacker.pos] +
                    (unpacker.qp[unpacker.pos + 1] << 8) +
                    (unpacker.qp[unpacker.pos + 2] << 16) +
                    (unpacker.qp[unpacker.pos + 3] << 24) +
                    (unpacker.qp[unpacker.pos + 4] << 32) +
                    (unpacker.qp[unpacker.pos + 5] << 40) +
                    (unpacker.qp[unpacker.pos + 6] << 48) +
                    (unpacker.qp[unpacker.pos + 7] << 56);
                return extractUtf8(unpacker.qp, pos, unpacker.pos);
            case 0xe8:
                num = unpacker.qp[unpacker.pos++];
                return num < 0x80 ? num : num - 0x100;
            case 0xe9:
                num = unpacker.qp[unpacker.pos++] +
                        (unpacker.qp[unpacker.pos++] << 8);
                return num < 0x8000 ? num : num - 0x10000;
            case 0xea:
                num = unpacker.qp[unpacker.pos++] +
                        (unpacker.qp[unpacker.pos++] << 8) +
                        (unpacker.qp[unpacker.pos++] << 16) +
                        (unpacker.qp[unpacker.pos++] << 24);

                return num < 0x80000000 ? num : num - 0x100000000;
            case 0xeb:
                num = unpacker.qp[unpacker.pos++] +
                        (unpacker.qp[unpacker.pos++] << 8) +
                        (unpacker.qp[unpacker.pos++] << 16) +
                        (unpacker.qp[unpacker.pos++] << 24) +
                        (unpacker.qp[unpacker.pos++] << 32) +
                        (unpacker.qp[unpacker.pos++] << 40) +
                        (unpacker.qp[unpacker.pos++] << 48) +
                        (unpacker.qp[unpacker.pos++] << 56);
                return num < 0x8000000000000000 ?
                    num : num - 0x10000000000000000;
            case 0xec: // QP_DOUBLE
                num =
                    unpacker.qp[unpacker.pos++] +
                    (unpacker.qp[unpacker.pos++] <<  8) +
                    (unpacker.qp[unpacker.pos++] << 16) +
                    (unpacker.qp[unpacker.pos++] << 24);

                n =
                    unpacker.qp[unpacker.pos++] +
                    (unpacker.qp[unpacker.pos++] <<  8) +
                    (unpacker.qp[unpacker.pos++] << 16) +
                    (unpacker.qp[unpacker.pos++] << 24);

                sign = n & 0x80000000;     // 1 bit
                exp  = (n >> 20) & 0x7ff;  // 11 bits
                frac =  n & 0xfffff;       // 52 bits - 32bits (high word)

                if (!n || n === 0x80000000) { // 0.0 or -0.0
                    return 0;
                }

                if (exp === 0x7ff) { // NaN or Infinity
                    return frac ? NaN : (sign) ? -Infinity : Infinity;
                }

                return  (sign ? -1 : 1) *
                        ((frac | 0x100000) * Math.pow(2, exp - 1023 - 20) +
                        num * Math.pow(2, exp - 1023 - 52));
            case 0xed:
            case 0xee:
            case 0xef:
            case 0xf0:
            case 0xf1:
            case 0xf2:
                num = tp - 0xed;
                arr = [];
                for (n = 0; n < num; n++) {
                    arr.push(_decode(unpacker));
                }
                return arr;
            case 0xf3:
            case 0xf4:
            case 0xf5:
            case 0xf6:
            case 0xf7:
            case 0xf8:
                num = tp - 0xf3;
                obj = {};
                for (n = 0; n < num; n++) {
                    obj[_decode(unpacker)] = _decode(unpacker);
                }
                return obj;
            case 0xf9:
                return true;
            case 0xfa:
                return false;
            case 0xfb:
                return null;
            case 0xfc:
                arr = [];
                while ( unpacker.pos < unpacker.qp.byteLength &&
                        unpacker.qp[unpacker.pos] !== 0xfe) {
                    arr.push(_decode(unpacker));
                }
                unpacker.pos++;
                return arr;
            case 0xfd:
                obj = {};
                while ( unpacker.pos < unpacker.qp.byteLength &&
                        unpacker.qp[unpacker.pos] !== 0xff) {
                    obj[_decode(unpacker)] = _decode(unpacker);
                }
                unpacker.pos++;
                return obj;
            default:
                throw new Error(
                    'QPack found an unexpected type while decoding: ' +
                    tp.toString());
        }
    }

    var qpack = {
        encode: function (obj, toString) {
            var arr = [];
            _encode(obj, arr);
            return (toString) ?
                String.fromCharCode.apply(null, arr) : new Uint8Array(arr);
        },
        decode: function (qp) {
            var unpacker = {
                qp: qp,
                pos: 0
            };
            return _decode(unpacker);
        }
    };

    window.qpack = qpack;

})();