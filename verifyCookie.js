const { MongoClient } = require('mongodb')
const bcrypt = require('bcrypt')

var url = 'mongodb://localhost:27017/'
const client = new MongoClient(url)

const verifyCookie = async (cookie) => {
    await client.connect()
    const database = client.db('mySocialMedia')

    const cookieColl = database.collection('cookies')
    const cookies = cookieColl.find({}, { cookies: 1, email: 1 })
    const cookiesDoc = await cookies.toArray()

    for (let i = 0; i < cookiesDoc.length; i++) {
        for (let j = 0; j <= cookiesDoc[i].cookies.length; j++) {
            if (cookiesDoc[i].cookies.length == 0 || j < cookiesDoc[i].cookies.length) {
                if (await bcrypt.compare(cookie, cookiesDoc[i].cookies[j])) {
                    const accountColl = database.collection('accounts')
                    const accountResult = accountColl.find({ email: cookiesDoc[i].email }).project({ _id: 1 })
                    const accountDoc = await accountResult.toArray()

                    await client.close()
                    return accountDoc[0]._id.toString()
                }

                else if (i == cookiesDoc.length - 1 && (cookiesDoc[i].cookies.length == 0 || j == cookiesDoc[i].cookies.length - 1) && await bcrypt.compare(cookie, docs[i].cookies[j]) == false) {
                    await client.close()
                    return null
                }
            }
        }
    }
}

module.exports = { verifyCookie }