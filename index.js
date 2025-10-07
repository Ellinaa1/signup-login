const express = require("express")
const db = require("./models")
const userRouter = require("./routes/users.js")
const {sequelize} = db
const swaggerUI = require('swagger-ui-express')
const YAML = require('yamljs')

const app = express()

const docs=YAML.load("./docs/api.yaml")

app.use(express.urlencoded())
app.use(express.json())
app.use("/users", userRouter)
app.use("/api", swaggerUI.serve, swaggerUI.setup(docs))

sequelize.sync({alter:true}).then(() => {
    console.log("DB is synced!")
})
app.listen(4002, () => console.log("Server started on http://localhost:4002"))


