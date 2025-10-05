const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const  authMiddleware = require('../middlewares/auth.js')
const { User } = require("../models")
dotenv.config()

router.post("/auth/signup", async (req,res) => {
    try{
        const {name, surname, age, login, password} = req.body
        if(!name.trim() || !surname.trim() || !login.trim() || !password.trim())
            return res.status(400).send("Please, fill all the fields")

        if(!age || age <= 0 || isNaN(age) || age > 122) 
            return res.status(400).send({message: "Age must be a valid number"})

        const found = await User.findOne({where: {login}})
        if(found) 
            return res.status(400).send({message: "User with such login already exists"})
        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await User.create({name, surname, age, login, password: hashedPassword})
        res.status(201).send({message: "User created successfully"})
    } catch(err) {
        console.error(err)
        return res.status(500).send({message: "Internal Server Error"})
    }
})
router.post("/auth/login", async (req,res) => {
    try {
        const {login, password} = req.body
        
        const found = await User.findOne({where: {login}})
        if(!found) 
            return res.status(404).send({message: "No user is found with such login"})

        if(found.isBlocked) {
            const now = Math.floor(Date.now() / 1000) // seconds
            const waitTime = 120 // two minutes
            if(now - found.blockedTime < waitTime) {  // 2 ropen chi ancel
                const remaining = waitTime - (now - found.blockedTime)
                return res.status(400).send({message: `Please, wait ${remaining} seconds to try again`})
            } else { // 2 ropen ancel a so unblock
                found.attempts = 0
                found.isBlocked = 0
                found.blockedTime = -1
                await found.save()
            }
        }

        const validPassword = await bcrypt.compare(password, found.password)
        if(!validPassword) {
            found.attempts += 1
            if(found.attempts >= 3) { 
                found.isBlocked = 1
                found.blockedTime = Math.floor(Date.now() / 1000)
                await found.save()
                return res.status(400).send({message: "3 failed tries. Please, wait 2 minutes to try again"})
            }
            await found.save()
            return res.status(400).send({message: "Wrong user credentials"})
        }
        const token = jwt.sign({id: found.id, login: found.login}, process.env.JWT_SECRET, {expiresIn: '1h'})
        return res.send({message: "Login successful", token})
    }catch(err) {
        console.error(err)
        return res.status(500).send({message: "Internal server error"})
    }
   
})
router.get("/", authMiddleware, async (req,res) => {
    try{
        const {id} = req.user
        const user = await User.findOne({where: {id}, attributes: ['name', 'surname', 'age', 'login']})
        return res.status(200).send({message: "Success", user})
    }catch(err) {
        console.error(err)
        res.status(500).send({message: "Internal server error"})
    }
})
module.exports = router