const Express = require("express");
const App = Express();

App.use(Express.static("./"))

App.listen(3020, e => {
    console.log(`http://localhost:3020`);
})