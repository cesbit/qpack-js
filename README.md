QPack JavaScript
================

Library for encoding and decoding QPack data using pure JavaScript.

Usage example:
```javascript
var iris = {
  name: 'Iris',
  age: 3
};

// encode iris to a binary string
var qp = qpack.encode(iris, true);

// decode qp binary string to JavaScript object.
var data = qpack.decode(qp);

console.log(data);  // {name: 'Iris', age: 3}
```
