QPack JavaScript
================

Library for encoding and decoding QPack data using pure JavaScript.

Usage example:
```javascript
data = {
  name: 'Iris',
  age: 3
}

// encode iris to a qp binary string
qp = qpack.encode(data, true);

// decode qp binary string to JavaScript object.
iris = qp.decode(qp);

console.log(iris); // {name: 'Iris', age: 3}
```
