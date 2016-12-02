'use strict';

/*
 * QPack packs and unpacks unsigned integers as little endian.
 *
 */

(function () {

    var QP_DOUBLE = 0xec;
    var QP_RAW8 = 0xe4;
    var QP_RAW16 = 0xe5;
    var QP_RAW32 = 0xe6;
    var QP_RAW64 = 0xe7;

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
            if (obj !== obj) { // isNaN
                arr.push(
                    QP_DOUBLE,
                    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
            } else if (obj === Infinity) {  // positive infinity
                arr.push(
                    QP_DOUBLE,
                    0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
            } else if (Math.floor(obj) === obj) { // int or uint
                if (obj < 0) {
                    // int
                    // if (mix >= -32) { // negative fixnum
                    //     rv.push(0xe0 + mix + 32);
                    // } else if (mix > -0x80) {
                    //     rv.push(0xd0, mix + 0x100);
                    // } else if (mix > -0x8000) {
                    //     mix += 0x10000;
                    //     rv.push(0xd1, mix >> 8, mix & 0xff);
                    // } else if (mix > -0x80000000) {
                    //     mix += 0x100000000;
                    //     rv.push(0xd2, mix >>> 24, (mix >> 16) & 0xff,
                    //                               (mix >>  8) & 0xff, mix & 0xff);
                    // } else {
                    //     high = Math.floor(mix / 0x100000000);
                    //     low  = mix & 0xffffffff;
                    //     rv.push(0xd3, (high >> 24) & 0xff, (high >> 16) & 0xff,
                    //                   (high >>  8) & 0xff,         high & 0xff,
                    //                   (low  >> 24) & 0xff, (low  >> 16) & 0xff,
                    //                   (low  >>  8) & 0xff,          low & 0xff);
                    // }
                } else {
                    // uint
                    // if (mix < 0x80) {
                    //     rv.push(mix); // positive fixnum
                    // } else if (mix < 0x100) { // uint 8
                    //     rv.push(0xcc, mix);
                    // } else if (mix < 0x10000) { // uint 16
                    //     rv.push(0xcd, mix >> 8, mix & 0xff);
                    // } else if (mix < 0x100000000) { // uint 32
                    //     rv.push(0xce, mix >>> 24, (mix >> 16) & 0xff,
                    //                               (mix >>  8) & 0xff, mix & 0xff);
                    // } else {
                    //     high = Math.floor(mix / 0x100000000);
                    //     low  = mix & 0xffffffff;
                    //     rv.push(0xcf, (high >> 24) & 0xff, (high >> 16) & 0xff,
                    //                   (high >>  8) & 0xff,         high & 0xff,
                    //                   (low  >> 24) & 0xff, (low  >> 16) & 0xff,
                    //                   (low  >>  8) & 0xff,          low & 0xff);
                    // }
                }
            } else { // double
                // THX!! @edvakf
                // http://javascript.g.hatena.ne.jp/edvakf/20101128/1291000731
                var sign = obj < 0;
                if (sign) obj *= -1;

                // add offset 1023 to ensure positive
                // 0.6931471805599453 = Math.LN2;
                var exp  = ((Math.log(obj) / 0.6931471805599453) + 1023) | 0;

                // shift 52 - (exp - 1023) bits to make integer part exactly 53 bits,
                // then throw away trash less than decimal point
                var frac = obj * Math.pow(2, 52 + 1023 - exp);

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
                var low  = frac & 0xffffffff;
                if (sign) exp |= 0x800;
                var high = ((frac / 0x100000000) & 0xfffff) | (exp << 20);

                arr.push(0xcb, (high >> 24) & 0xff, (high >> 16) & 0xff,
                              (high >>  8) & 0xff,  high        & 0xff,
                              (low  >> 24) & 0xff, (low  >> 16) & 0xff,
                              (low  >>  8) & 0xff,  low         & 0xff);
            }
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
            var obj = {};
            return obj;
        }
    };

    window.qpack = qpack;

})();