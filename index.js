const express = require("express")
const db = require("./models")
const userRouter = require("./routes/users.js")
const {sequelize} = db

const app = express()

app.use(express.urlencoded())
app.use(express.json())
app.use("/users", userRouter)

sequelize.sync({alter:true}).then(() => {
    console.log("DB is synced!")
})
app.listen(4002, () => console.log("Server started on http://localhost:4002"))


