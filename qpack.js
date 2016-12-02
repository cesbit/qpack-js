'use strict';

/*
 * QPack packs and unpacks unsigned integers as little endian.
 *
 */

(function () {

    var QP_HOOK = 0x7c;
    var QP_DOUBLE = 0xec;

    var QP_RAW8 = 0xe4;
    var QP_RAW16 = 0xe5;
    var QP_RAW32 = 0xe6;
    var QP_RAW64 = 0xe7;

    var QP_INT8 = 0xe8;
    var QP_INT16 = 0xe9;
    var QP_INT32 = 0xea;
    var QP_INT64 = 0xeb;

    var QP_BOOL_TRUE = 0xf9;
    var QP_BOOL_FALSE = 0xfa;
    var QP_NULL = 0xfb;

    var QP_OPEN_ARRAY = 0xfc;
    var QP_OPEN_MAP = 0xfd;
    var QP_CLOSE_ARRAY = 0xfe;
    var QP_CLOSE_MAP = 0xff;
    /*
     *  https://coolaj86.com/articles/
     *      unicode-string-to-a-utf-8-typed-array-buffer-in-javascript/
     */
    function unicodeStringToTypedArray (s) {
        var escstr = encodeURIComponent(s);

        var binstr = escstr.replace(/%([0-9A-F]{2})/g, function (match, p1) {
            return String.fromCharCode('0x' + p1);
        });

        var ua = new Uint8Array(binstr.length);

        Array.prototype.forEach.call(binstr, function (ch, i) {
            ua[i] = ch.charCodeAt(0);
        });

        return ua;
    }

    /*
     *  https://coolaj86.com/articles/
     *      unicode-string-to-a-utf-8-typed-array-buffer-in-javascript/
     */
    function typedArrayToUnicodeString (ua) {
        var binstr = Array.prototype.map.call(ua, function (ch) {
            return String.fromCharCode(ch);
        }).join('');

        var escstr = binstr.replace(/(.)/g, function (m, p) {
            var code = p.charCodeAt(p).toString(16).toUpperCase();
            if (code.length < 2) {
                code = '0' + code;
            }
            return '%' + code;
        });

        return decodeURIComponent(escstr);
    }



    function _encode (obj, arr, len) {
        if (obj === true) {
            arr.push(QP_BOOL_TRUE);
            return len + 1;
        }

        if (obj === false) {
            arr.push(QP_BOOL_FALSE);
            return len + 1;
        }

        if (obj === null) {
            arr.push(QP_NULL);
            return len + 1;
        }

        var type = typeof obj;

        if (type === 'string') {
            obj = unicodeStringToTypedArray(obj);
        }

        if (obj instanceof Uint8Array) {
            if (obj.byteLength < 0x64) {
                arr.push(
                    0x80 + obj.byteLength,
                    obj);
                return len + obj.byteLength + 1;
            }

            if (obj.byteLength < 0x100) {
                arr.push(
                    QP_RAW8,
                    obj.byteLength,
                    obj);
                return len + obj.byteLength + 2;
            }

            if (obj.byteLength < 0x10000) {
                arr.push(
                    QP_RAW16,
                    obj.byteLength & 0xff,
                    (obj.byteLength >> 8) & 0xff,
                    obj);
                arr.push();
                arr.push();
                return len + obj.byteLength + 3;
            }

            if (obj.byteLength < 0x100000000) {
                arr.push(
                    QP_RAW32,
                    obj.byteLength & 0xff,
                    (obj.byteLength >> 8) & 0xff,
                    (obj.byteLength >> 16) & 0xff,
                    (obj.byteLength >> 24) & 0xff,
                    obj);
                return len + obj.byteLength + 5;
            }

            if (obj.byteLength < 0x10000000000000000) {
                arr.push(
                    QP_RAW64,
                    obj.byteLength & 0xff,
                    (obj.byteLength >> 8) & 0xff,
                    (obj.byteLength >> 16) & 0xff,
                    (obj.byteLength >> 24) & 0xff,
                    (obj.byteLength >> 32) & 0xff,
                    (obj.byteLength >> 40) & 0xff,
                    (obj.byteLength >> 48) & 0xff,
                    (obj.byteLength >> 56) & 0xff,
                    obj);
                return len + obj.byteLength + 9;
            }

            throw new Error(
                    'String or bytes too long: ' + obj.byteLength.toString());
        }

        if (type === 'number') {
            if (obj !== obj) {
                /*
                 * Pack isNaN
                 */
                arr.push(
                    QP_DOUBLE,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf8, 0x7f);

                return len + 9;

            }

            if (obj === Infinity) {
                /*
                 * Pack positive Infinity
                 */
                arr.push(
                    QP_DOUBLE,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0x7f);

                return len + 9;
            }

            if (obj === -Infinity) {
                /*
                 * Pack nagative Infinity
                 */
                arr.push(
                    QP_DOUBLE,
                    0xec, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0xff);

                return len + 9;
            }

            if (obj === (obj | 0)) {
                /*
                 * Pack integer type. Note that in JavaScript values like
                 * 1.0 are exactly the same as 1. There is no way to make
                 * a difference between these two.
                 */
                if (obj >= 0 && obj < 64) {
                    arr.push(obj);
                    return len + 1;
                }

                if (obj >= -60 && obj < 0) {
                    arr.push(63 - obj);
                    return len + 1;
                }

                if (obj > -0x80 && obj < 0x80) {
                    arr.push(QP_INT8, obj);
                    return len + 2;
                }

                if (obj > -0x8000 && obj < 0x8000) {
                    arr.push(
                        QP_INT16,
                        obj & 0xff,
                        (obj >> 8) & 0xff);
                    return len + 3;
                }

                if (obj > -0x80000000 && obj < 0x80000000) {
                    arr.push(
                        QP_INT32,
                        obj & 0xff,
                        (obj >> 8) & 0xff,
                        (obj >> 16) & 0xff,
                        (obj >> 24) & 0xff);
                    return len + 5;
                }

                if (obj > -0x8000000000000000 && obj < 0x8000000000000000) {
                    arr.push(
                        QP_INT64,
                        obj & 0xff,
                        (obj >> 8) & 0xff,
                        (obj >> 16) & 0xff,
                        (obj >> 24) & 0xff,
                        (obj >> 32) & 0xff,
                        (obj >> 40) & 0xff,
                        (obj >> 48) & 0xff,
                        (obj >> 56) & 0xff);
                    return len + 9;
                }

                throw new Error(
                    'Qpack got an overflow error while encoding: ', obj);

            }

            /*
             * Pack double type
             * http://javascript.g.hatena.ne.jp/edvakf/20101128/1291000731
             */
            var sign, exp, frac, low, high;

            sign = obj < 0;
            if (sign) obj *= -1;

            // add offset 1023 to ensure positive
            // 0.6931471805599453 = Math.LN2;
            exp  = ((Math.log(obj) / 0.6931471805599453) + 1023) | 0;

            // shift 52 - (exp - 1023) bits to make integer part exactly 53 bits,
            // then throw away trash less than decimal point
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

            return len + 9;
        }

        if (Array.isArray(obj)) {
            if (obj.length < 6) {
                arr.push(0xed + obj.length);
                len++;

                obj.forEach(function (o) {
                    len = _encode(o, arr, len);
                });
            } else {
                arr.push(QP_OPEN_ARRAY);
                len++;

                obj.forEach(function (o) {
                    len = _encode(o, arr, len);
                });

                arr.push(QP_CLOSE_ARRAY);
                len++;
            }

            return len;
        }

        if (type === 'object') {
            var keys = Object.keys(obj);

            if (keys.length < 6) {
                arr.push(0xf3 + keys.length);
                len++;

                keys.forEach(function (key) {
                    len = _encode(key, arr, len);
                    len = _encode(obj[key], arr, len);
                });
            } else {
                arr.push(QP_OPEN_MAP);
                len++;

                keys.forEach(function (key) {
                    len = _encode(key, arr, len);
                    len = _encode(obj[key], arr, len);
                });

                arr.push(QP_CLOSE_MAP);
                len++;
            }

            return len;
        }

        throw new Error('QPack cannot encode type: ' + type);
    }

    function _decode (unpacker) {
        var arr, n, sign, exp, frac, pos, num, tp = unpacker.qp[unpacker.pos++];

        if (tp < 0x40) {
            return tp;
        }

        if (tp < 0x7c) {
            return 63 - tp;
        }

        if (tp === QP_HOOK) {
            return 0;   // reserverd for object hook.
        }

        if (tp < 0x80) {
            return tp - 126;
        }

        if (tp < 0xe4) {
            pos = unpacker.pos;
            unpacker.pos += tp - 128;
            return typedArrayToUnicodeString(unpacker.qp.slice(
                pos,
                unpacker.pos));
        }

        switch (tp) {
            case 0xe4:
                pos = unpacker.pos + 1;
                unpacker.pos = pos + unpacker.qp[unpacker.pos];
                return typedArrayToUnicodeString(unpacker.qp.slice(
                    pos,
                    unpacker.pos));
            case 0xe5:
                pos = unpacker.pos + 2;
                unpacker.pos =
                    pos +
                    unpacker.qp[unpacker.pos] +
                    (unpacker.qp[unpacker.pos + 1] << 8);
                return typedArrayToUnicodeString(unpacker.qp.slice(
                    pos,
                    unpacker.pos));
            case 0xe6:
                pos = unpacker.pos + 4;
                unpacker.pos =
                    pos +
                    unpacker.qp[unpacker.pos] +
                    (unpacker.qp[unpacker.pos + 1] << 8),
                    (unpacker.qp[unpacker.pos + 2] << 16),
                    (unpacker.qp[unpacker.pos + 3] << 24);
                return typedArrayToUnicodeString(unpacker.qp.slice(
                    pos,
                    unpacker.pos));
            case 0xe7:
                pos = unpacker.pos + 8;
                unpacker.pos =
                    pos +
                    unpacker.qp[unpacker.pos] +
                    (unpacker.qp[unpacker.pos + 1] << 8),
                    (unpacker.qp[unpacker.pos + 2] << 16),
                    (unpacker.qp[unpacker.pos + 3] << 24),
                    (unpacker.qp[unpacker.pos + 4] << 32),
                    (unpacker.qp[unpacker.pos + 5] << 40),
                    (unpacker.qp[unpacker.pos + 6] << 48),
                    (unpacker.qp[unpacker.pos + 7] << 56);
                return typedArrayToUnicodeString(unpacker.qp.slice(
                    pos,
                    unpacker.pos));
            case 0xe8:
                num = unpacker.qp[unpacker.pos++]
                return num < 0x80 ? num : num - 0x100;
            case 0xe9:
                num = unpacker.qp[unpacker.pos] +
                        (unpacker.qp[++unpacker.pos] << 8);
                return num < 0x8000 ? num : num - 0x10000;
            case 0xea:
                num = unpacker.qp[unpacker.pos] +
                        (unpacker.qp[++unpacker.pos] << 8),
                        (unpacker.qp[++unpacker.pos] << 16),
                        (unpacker.qp[++unpacker.pos] << 24);
                return num < 0x80000000 ? num : num - 0x100000000;
            case 0xeb:
                num = unpacker.qp[unpacker.pos] +
                        (unpacker.qp[++unpacker.pos] << 8),
                        (unpacker.qp[++unpacker.pos] << 16),
                        (unpacker.qp[++unpacker.pos] << 24),
                        (unpacker.qp[++unpacker.pos] << 32),
                        (unpacker.qp[++unpacker.pos] << 40),
                        (unpacker.qp[++unpacker.pos] << 48),
                        (unpacker.qp[++unpacker.pos] << 56);
                return num < 0x8000000000000000 ?
                    num : num - 0x10000000000000000;
            case 0xec: // QP_DOUBLE


                num =
                    unpacker.qp[unpacker.pos] +
                    (unpacker.qp[++unpacker.pos] <<  8) +
                    (unpacker.qp[++unpacker.pos] << 16) +
                    (unpacker.qp[++unpacker.pos] << 24);

                n =
                    unpacker.qp[++unpacker.pos] +
                    (unpacker.qp[++unpacker.pos] <<  8) +
                    (unpacker.qp[++unpacker.pos] << 16) +
                    (unpacker.qp[++unpacker.pos] << 24);

                sign = n & 0x80000000;     // 1 bit
                exp  = (n >> 20) & 0x7ff;  // 11 bits
                frac =  n & 0xfffff;       // 52 bits - 32bits (high word)

                if (!n || n === 0x80000000) { // 0.0 or -0.0
                    unpacker.pos += 4;
                    return 0;
                }

                if (exp === 0x7ff) { // NaN or Infinity
                    unpacker.pos += 4;
                    return frac ? NaN : (sign) ? -Infinity : Infinity;
                }

                return (sign ? -1 : 1) *
                    ((frac | 0x100000) * Math.pow(2, exp - 1023 - 20)
                    + num * Math.pow(2, exp - 1023 - 52));
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
            case 0xf2:
            case 0xf3:
            case 0xf4:
            case 0xf5:
            case 0xf6:
            case 0xf7:
        }

    }

    var qpack = {
        encode: function (obj) {
            var arr = [];
            var len = _encode(obj, arr, 0);
            var buffer = new Uint8Array(len);
            var i, offset = 0;

            arr.forEach(function (o) {
                if (o instanceof Uint8Array) {
                    for (i = 0; i < o.byteLength; i++, offset++) {
                        buffer[offset] = o[i];
                    }
                } else {
                    buffer[offset] = o;
                    offset++;
                }
            });

            return buffer;
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