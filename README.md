QPack JavaScript
================

Library for encoding and decoding QPack data using pure JavaScript.

Usage example:
```javascript
var iris = {
  name: 'Iris',
  age: 3
};

// Encode iris to a binary string.
// The second argument is true which tells the function to return a string.
// When false or undefined an Uint8Array is returned.
var qp = qpack.encode(iris, true);

// Decode qp binary string to JavaScript object.
var data = qpack.decode(qp);

console.log(data);  // {name: 'Iris', age: 3}
```

Float problem
-------------

Since JavaScript has no explicit integer type, QPack cannot tell the difference
between for example 1.0 and 1. By default 1.0 will be packed as integer so if you
want to force packing as float, the function `qpack.double(f)` can be used.

For example:
```javascript
// This will pack 1.0 as a double (float) value.
var qp = qpack.encode(qpack.double(1.0));
```
