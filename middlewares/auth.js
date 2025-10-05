const jwt = require('jsonwebtoken')
const dotenv = require('dotenv')
dotenv.config()

const authMiddleware = async (req,res,next) => {
    const authHeader = req.headers.authorization //bearer blabla
    if(!authHeader || !authHeader.startsWith("Bearer "))
        return res.status(400).send({message: "Please, provide an authorization token"})

    const token = authHeader.split(" ")[1]
    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET) // return the payload we provided ete sxal error
        req.user = decoded
        next()
    }catch(err) {
        console.error(err)
        return res.status(400).send({message: "Authentication error"})
    }
}
module.exports = authMiddleware