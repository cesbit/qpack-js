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

JavaScript has no integer type and therefore values like 1.0 and 1 are equal. QPack cannot known if such value should be packed as integer or as float. By default x.0 will be packed as integer x. Any other float like 1.2 will be packed as float. If you have a situation where you really want to pack a value as float, then wrap the value with the function `qpack.double(f)`.

For example:
```javascript
// This will pack 1.0 as a double (float) value.
var qp = qpack.encode(qpack.double(1.0), true);
```
