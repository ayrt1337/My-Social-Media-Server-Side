const { MongoClient } = require('mongodb')

var url = 'mongodb://localhost:27017/'
const client = new MongoClient(url)

const createAccout = async (email, password) => {
    await client.connect()

    const database = client.db('mySocialMedia')
    const coll = database.collection('accounts')

    const date = new Date()
    const months = ['Jan', 'Fev', 'Mai', 'Abr', 'Mar', 'Jun', 'Jul', 'Ago','Set', 'Out', 'Nov', 'Dec']

    const year = date.getFullYear()
    const month = date.getMonth()
    let day = date.getDate()
    let hours = date.getHours()
    let minutes = date.getMinutes()

    if(day < 10) day = '0' + day

    if(hours < 10) hours = '0' + hours

    if(minutes < 10) minutes = '0' + minutes

    const createTime = `${day} de ${months[month]} de ${year} · ${hours}:${minutes}`
    
    await coll.insertOne( { user: '', email: `${email}`, password: `${password}`, profileImg: null, bio: '', followers: [], following: [], likes: [], createdAt: createTime, notifications: [] } )
    await client.close()
}

module.exports = { createAccout }