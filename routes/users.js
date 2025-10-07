const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const dotenv = require('dotenv')
const nodemailer = require('nodemailer')
const jwt = require('jsonwebtoken')
const authMiddleware = require('../middlewares/auth.js')
const { User } = require("../models")
dotenv.config()

router.post("/auth/signup", async (req,res) => {
    try{
        const {name, surname, age, email, password} = req.body
        if(!name.trim() || !surname.trim() || !email.trim() || !password.trim())
            return res.status(400).send("Please, fill all the fields")

        if(!age || age <= 0 || isNaN(age) || age > 122) 
            return res.status(400).send({message: "Age must be a valid number"})

        const found = await User.findOne({where: {email}})
        if(found) 
            return res.status(400).send({message: "User with such email already exists"})

        const hashedPassword = await bcrypt.hash(password, 10)
        const verificationToken = crypto.randomBytes(32).toString("hex")

        const user = await User.create({name, surname, age, email, password: hashedPassword, verificationToken})

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        })
        const verifyUrl = `http://localhost:4002/users/auth/verify/${verificationToken}`
        await transporter.sendMail({
            to: user.email,
            subject: "Welcome! Verify your email to access your data",
            html: `
                <p>Hello ${user.name}, later, to access your data, you'll need to verify your account</p>
                <a href="${verifyUrl}">Verify your email</a>
            `
        })
        res.status(201).send({message: "User created successfully. Verify your email to later access your data"})
    } catch(err) {
        console.error(err)
        return res.status(500).send({message: "Internal Server Error"})
    }
})

router.post("/auth/login", async (req,res) => {
    try {
        const {email, password} = req.body
        
        const found = await User.findOne({where: {email}})
        if(!found) 
            return res.status(404).send({message: "No user is found with such email"})

        if(found.isBlocked) {
            const now = Math.floor(Date.now() / 1000) // seconds
            const waitTime = 120 // two minutes
            if(now - found.blockedTime < waitTime) {  
                const remaining = waitTime - (now - found.blockedTime)
                return res.status(400).send({message: `Please, wait ${remaining} seconds to try again`})
            } else { 
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

        const token = jwt.sign({id: found.id, email: found.email}, process.env.JWT_SECRET, {expiresIn: '1h'})
        return res.send({message: "Login successful", token})
    }catch(err) {
        console.error(err)
        return res.status(500).send({message: "Internal server error"})
    }
})

router.get("/user", authMiddleware, async (req,res) => {
    try {
        const {id} = req.user;
        const user = await User.findOne({
            where: {id}
        })
        if(!user) return res.status(404).send({message: "User not found"});

        if(!user.isVerified) {
            let token = user.verificationToken

            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            })
            const verifyUrl = `http://localhost:4002/users/auth/verify/${token}`
            await transporter.sendMail({
                to: user.email,
                subject: "Welcome! Verify your email to access your data",
                html: `
                    <p>Hello ${user.name},verify your account to access your data</p>
                    <a href="${verifyUrl}">Verify your email</a>
                `
            })
            return res.status(400).send({message: "Please, verify your email to access your data"})
        }

        return res.status(200).send({message: "Success", user: {name: user.name, surname: user.surname, age: user.age, email: user.email}});

    }catch(err) {
        console.error(err)
        res.status(500).send({message: "Internal server error"})
    }
});

router.get("/auth/verify/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const user = await User.findOne({where: {verificationToken: token}});

        if (!user)
            return res.status(400).send({message: "Invalid or expired verification link." });

        user.isVerified = true;
        user.verificationToken = null;
        await user.save();

        res.send({ message: "Email verified successfully. You can now access your data." });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Internal server error." });
    }
})


module.exports = router