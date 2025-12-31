const nodemailer = require('nodemailer')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const handlebars = require('handlebars')

const source = fs.readFileSync('./email-template/emailTemplate.html', 'utf8').toString()
const template = handlebars.compile(source)

const sendEmail = (email, reason) => {
    var message = ''

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: '<Insira um email>',
            pass: '<Insira a senha de aplicativo do email utilizado>'
        }
    })

    const token = jwt.sign({
        data: 'Token Data'
    }, 'secret_key', { expiresIn: '10m' }    
    )

    const replacements = {
        email: reason == 'register' ? email : '',
        image: reason == 'register' ? 'https://i.ibb.co/XrFNxWH0/10542536.png' : 'https://i.ibb.co/k234jXft/Design-sem-nome-5.png',
        title: reason == 'register' ? 'Verifique seu email para finalizar seu cadastro' : 'Solicitação de alteração de senha',
        text: reason == 'register' ? `Por favor confirme que ` : 'Para alterar sua senha clique no botão abaixo dentro de 10 minutos',
        text2: reason == 'register' ? ` é o seu email clicando no botão abaixo dentro de 10 minutos` : '',
        link: reason == 'register' ? `http://localhost:5173/verifyemail?token=${token}&email=${email}` : `http://localhost:5173/verifypassword?token=${token}&email=${email}`,
        btn: reason == 'register' ? 'Confirmar Email' : 'Alterar Senha'
    }

    const htmlEmail = template(replacements)

    message = {
        from: '<Insira o email utilizado>',
        to: `${email}`,
        subject: reason == 'register' ? 'Confirmação de Email' : 'Alteração de Senha',
        html: htmlEmail
    }


    transporter.sendMail(message, (error, info) => {
        if (error) {
            console.log(error)
        }
    })

    return token
}

const confirmEmail = (token) => {
    try {
        const verify = jwt.verify(token, 'secret_key')

        if (verify) return true
    }
    catch (err) {
        return false
    }
}

module.exports = { sendEmail, confirmEmail }