const { MongoClient } = require('mongodb')
const bcrypt = require('bcrypt')

var url = 'mongodb://localhost:27017/'
const client = new MongoClient(url)
const saltRounds = 10

const updateAccout = async (email, password) => {
    await client.connect()
    const database = client.db('mySocialMedia')
    const coll = database.collection('accounts')

    const hash = await bcrypt.hash(password, saltRounds)

    const filter = { email: email }
    const updateDoc = {
        $set: {
            password: hash
        }
    }

    await coll.updateOne(filter, updateDoc)
    await client.close()
}

module.exports = { updateAccout }