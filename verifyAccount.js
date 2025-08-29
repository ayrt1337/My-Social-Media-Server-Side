const { MongoClient } = require('mongodb')

var url = 'mongodb://localhost:27017/'
const client = new MongoClient(url)

const verifyAccount = async (email, reason) => {
    await client.connect()
    var number = 0

    const database = client.db('mySocialMedia')
    const coll = database.collection('accounts')

    const query = { 'email': email }
    const verify = coll.find(query)

    for await (const doc of verify){
        if(doc) number++
    }

    await client.close()
    
    if((number == 1 && reason == 'register') || (number == 0 && reason == 'reset')) return false

    else if((number == 0 && reason == 'register') || (number == 1 && reason == 'reset')) return true
}

module.exports = { verifyAccount }