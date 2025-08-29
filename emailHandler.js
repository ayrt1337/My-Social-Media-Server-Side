const nodemailer = require('nodemailer')
const jwt = require('jsonwebtoken')

const sendEmail = (email, reason) => {
    var message = ''

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: '<Insira um email>',
            pass: '<Insira o passkey do email utilizado>'
        }
    })

    const token = jwt.sign({
            data: 'Token Data'
        }, 'secret_key', { expiresIn: '5m' }
    )

    if(reason == 'register'){
        message = {
            from: 'testingapptestingapp803@gmail.com',
            to: `${email}`,
            subject: 'Confirmação de Email',
            html: `<p>Hello World!</p>
                   <a href="http://localhost:5173/verifyemail?token=${token}&email=${email}">Verificar</a>`
        }
    }

    else{
        message = {
            from: 'testingapptestingapp803@gmail.com',
            to: `${email}`,
            subject: 'Trocar Senha',
            html: `<p>Hello World!</p>
                   <a href="http://localhost:5173/verifypassword?token=${token}&email=${email}">Verificar</a>`
        }
    }

    transporter.sendMail(message, (error, info) => {
        if(error){
            console.log(error)
        }
    })

    return token
}

const confirmEmail = (token) => {
    try{
        const verify = jwt.verify(token, 'secret_key')

        if(verify) return true
    }
    catch(err){
        return false
    }
}

module.exports = { sendEmail, confirmEmail }
