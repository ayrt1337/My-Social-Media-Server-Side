const express = require('express')
const cors = require('cors')
const { MongoClient, ObjectId } = require('mongodb')
const bcrypt = require('bcrypt')
const cookieParser = require('cookie-parser')
const { sendEmail, confirmEmail } = require('./emailHandler')
const { createAccout } = require('./createAccout')
const { verifyAccount } = require('./verifyAccount')
const { updateAccout } = require('./updateAccout')
const { verifyCookie } = require('./verifyCookie')
const { v4: uuidv4 } = require('uuid')

const app = express()
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb' }))
app.use(cookieParser())

const options = {
    origin: 'http://localhost:5173',
    credentials: true
}

app.use(cors(options))

app.listen(3000, () => {
    console.log('Server Started')
})

var url = 'mongodb://localhost:27017/'
const client = new MongoClient(url)
const database = client.db('mySocialMedia')
const coll = database.collection('tokens')
const saltRounds = 10

app.post('/confirmEmail', async (req, res) => {
    const email = req.body.email.toLowerCase()

    if (await verifyAccount(email, 'register')) {
        const token = sendEmail(email, 'register')

        const results = coll.find()
        const docs = await results.toArray()
        const hash = await bcrypt.hash(req.body.password, saltRounds)

        if (docs.length == 0) await coll.insertOne({ 'email': email, 'password': hash, 'tokens': [token] })

        else {
            const result = coll.find({ email: email }).project({ password: 1, tokens: 1, _id: 0 })
            const doc = await result.toArray()

            if (doc.length == 1) {
                const filter = { email: email }
                const updateDoc = {
                    $set: {
                        password: hash,
                        tokens: [...doc[0].tokens, token]
                    }
                }

                await coll.updateOne(filter, updateDoc)
            }

            else await coll.insertOne({ 'email': email, 'password': hash, 'tokens': [token] })
        }

        res.status(200).json({
            status: 'success'
        })
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.post('/verify', async (req, res) => {
    const token = req.body.token
    const email = req.body.email

    if (confirmEmail(token)) {
        const result = coll.find({ email: email }).project({ password: 1, tokens: 1, _id: 0 })
        const doc = await result.toArray()

        if (doc.length == 1) {
            for (let i = 0; i <= doc[0].tokens.length - 1; i++) {
                if (token == doc[0].tokens[i]) {
                    await createAccout(email, doc[0].password)
                    coll.deleteOne({ email: email })
                    break
                }
            }
        }

        res.status(200).json({
            status: 'success'
        })
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.post('/reset', async (req, res) => {
    const email = req.body.email.toLowerCase()

    if (await verifyAccount(email, 'reset')) {
        const token = sendEmail(email, 'reset')

        const results = coll.find()
        const docs = await results.toArray()

        if (docs.length == 0) await coll.insertOne({ 'email': email, 'tokens': [token] })

        else {
            const result = coll.find({ email: email }).project({ tokens: 1, _id: 0 })
            const doc = await result.toArray()

            if (doc.length == 1) {
                const filter = { email: email }
                const updateDoc = {
                    $set: {
                        tokens: [...doc[0].tokens, token]
                    }
                }

                await coll.updateOne(filter, updateDoc)
            }

            else await coll.insertOne({ 'email': email, 'tokens': [token] })
        }
    }

    res.status(200).json({
        status: 'success'
    })
})

app.post('/verifypassword', async (req, res) => {
    const token = req.body.token
    const email = req.body.email
    const password = req.body.password

    if (confirmEmail(token)) {
        const result = coll.find({ email: email }).project({ password: 1, tokens: 1, _id: 0 })
        const doc = await result.toArray()

        if (doc.length == 1) {
            for (let i = 0; i <= doc[0].tokens.length - 1; i++) {
                if (token == doc[0].tokens[i]) {
                    await updateAccout(email, password)
                    coll.deleteOne({ email: email })
                    break
                }
            }
        }

        res.status(200).json({
            status: 'success'
        })
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.post('/login', async (req, res) => {
    const email = req.body.email.toLowerCase()
    const password = req.body.password
    const login = req.body.login

    const accountColl = database.collection('accounts')
    const result = accountColl.find({ email: email }).project({ password: 1, _id: 0 })
    const doc = await result.toArray()

    if (doc.length == 1) {
        if (await bcrypt.compare(password, doc[0].password)) {
            const cookieColl = database.collection('cookies')

            const cookies = cookieColl.find({}, { cookies: 1, _id: 0, email: 0 })
            const cookiesDoc = await cookies.toArray()

            const cookie = cookieColl.find({ email: email }).project({ cookies: 1, _id: 0, email: 1 })
            const cookieDoc = await cookie.toArray()
            var token = uuidv4()

            if (cookiesDoc.length == 0) {
                res.cookie('access_token', token, { maxAge: login == true ? 3600000 * 8766 : null, httpOnly: false })
                token = await bcrypt.hash(token, saltRounds)
                cookieColl.insertOne({ email: email, cookies: [token] })
            }

            else {
                for (let i = 0; i < cookiesDoc.length; i++) {
                    for (let j = 0; j < cookiesDoc[i].cookies.length; j++) {
                        if (await bcrypt.compare(token, cookiesDoc[i].cookies[j])) {
                            token = uuidv4()
                            i = 0
                        }

                        else if (i == cookiesDoc.length - 1 && j == cookiesDoc[i].cookies.length - 1 && await bcrypt.compare(token, cookiesDoc[i].cookies[j]) == false) {
                            res.cookie('access_token', token, { maxAge: login == true ? 3600000 * 8766 : null, httpOnly: false })
                            token = await bcrypt.hash(token, saltRounds)
                        }
                    }
                }

                if (req.cookies.access_token == undefined) {
                    if (cookieDoc.length == 1) {
                        const updateDoc = { $set: { cookies: [...cookieDoc[0].cookies, token] } }
                        await cookieColl.updateOne({ email: email }, updateDoc)
                    }

                    else {
                        cookieColl.insertOne({ email: email, cookies: [token] })
                    }
                }

                else {
                    if (cookieDoc.length == 1) {
                        for (let i = 0; i < cookieDoc[0].cookies.length; i++) {
                            if (await bcrypt.compare(req.cookies.access_token, cookieDoc[0].cookies[i])) {
                                cookieDoc[0].cookies.splice(cookieDoc[0].cookies.indexOf(cookieDoc[0].cookies[i]), 1)
                                const updateDoc = { $set: { cookies: [...cookieDoc[0].cookies, token] } }
                                await cookieColl.updateOne({ email: email }, updateDoc)
                                break
                            }

                            else if (i == cookieDoc[0].cookies.length - 1 && await bcrypt.compare(req.cookies.access_token, cookieDoc[0].cookies[i]) == false) {
                                const updateDoc = { $set: { cookies: [...cookieDoc[0].cookies, token] } }
                                await cookieColl.updateOne({ email: email }, updateDoc)
                            }
                        }
                    }

                    else {
                        cookieColl.insertOne({ email: email, cookies: [token] })
                    }
                }
            }

            res.status(200).json({
                status: 'success'
            })
        }

        else {
            res.status(200).json({
                status: 'fail'
            })
        }
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.get('/session', async (req, res) => {
    const cookie = req.cookies.access_token

    if (cookie != undefined) {
        const cookieColl = database.collection('cookies')
        const result = cookieColl.find().project({ _id: 0, email: 1, cookies: 1 })
        const docs = await result.toArray()
        var user = null

        if (docs.length > 0) {
            for (let i = 0; i < docs.length; i++) {
                if (typeof user == 'string') break

                for (let j = 0; j < docs[i].cookies.length; j++) {
                    if (await bcrypt.compare(cookie, docs[i].cookies[j])) {
                        const accoutColl = database.collection('accounts')
                        const result2 = accoutColl.find({ email: docs[i].email }, { password: 0, email: 0 })
                        const doc = await result2.toArray()

                        const unreadMessages = doc[0].notifications.filter((element) => {
                            return element.unread == true
                        }).length

                        const img = doc[0].profileImg
                        user = doc[0].user

                        res.status(200).json({
                            user: user,
                            img: img,
                            notifications: unreadMessages == 0 ? undefined : unreadMessages
                        })

                        break
                    }

                    else if (j == docs[i].cookies.length - 1 && i == docs.length - 1 && cookie != docs[i].cookies[j]) {
                        res.status(200).json({
                            status: 'fail'
                        })
                    }
                }
            }
        }

        else {
            res.status(200).json({
                status: 'fail'
            })
        }
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.get('/logout', async (req, res) => {
    const cookie = req.cookies.access_token
    const cookieColl = database.collection('cookies')
    const result = cookieColl.find({}, { cookies: 1, email: 1, _id: 0 })
    const docs = await result.toArray()
    var flag = null

    if (cookie == undefined) {
        res.status(200).json({
            status: 'success'
        })
    }

    else {
        for (let i = 0; i < docs.length; i++) {
            if (typeof flag == 'boolean') break

            for (let j = 0; j < docs[i].cookies.length; j++) {
                if (await bcrypt.compare(cookie, docs[i].cookies[j])) {
                    if (docs[i].cookies.length == 1) {
                        await cookieColl.deleteOne({ email: docs[i].email })
                    }

                    else {
                        docs[i].cookies.splice(docs[i].cookies.indexOf(docs[i].cookies[j]), 1)
                        await cookieColl.updateOne({ email: docs[i].email }, { $set: { cookies: docs[i].cookies } })
                    }

                    res.clearCookie('access_token')
                    flag = true
                    break
                }

                else if (i == docs.length - 1 && j == docs[i].cookies.length - 1 && cookie != docs[i].cookies[j]) {
                    res.clearCookie('access_token')
                }
            }
        }

        res.status(200).json({
            status: 'success'
        })
    }
})

app.post('/verifyUser', async (req, res) => {
    const user = req.body.user

    const accountColl = database.collection('accounts')
    const users = accountColl.find({}, { _id: 0, email: 0, password: 0, user: 1 })
    const arrUsers = await users.toArray()

    for (let i = 0; i < arrUsers.length; i++) {
        if (user == arrUsers[i].user) {
            res.status(200).json({
                status: 'fail'
            })

            break
        }

        else if (user != arrUsers[i].user && i == arrUsers.length - 1) {
            res.status(200).json({
                status: 'success'
            })
        }
    }
})

app.post('/updateUser', async (req, res) => {
    const user = req.body.user
    const cookie = req.cookies.access_token

    const cookiesColl = database.collection('cookies')
    const docs = cookiesColl.find().project({ _id: 0, email: 1, cookies: 1 })
    const cookies = await docs.toArray()
    var flag = null

    for (let i = 0; i < cookies.length; i++) {
        if (flag) break

        for (let j = 0; j < cookies[i].cookies.length; j++) {
            if (await bcrypt.compare(cookie, cookies[i].cookies[j])) {
                const accoutColl = database.collection('accounts')
                await accoutColl.updateOne({ email: cookies[i].email }, { $set: { user: user } })
                flag = true
                break
            }
        }
    }

    res.status(200).json({
        status: 'success'
    })
})

app.post('/getUserData', async (req, res) => {
    const user = req.body.requestedUser
    const clientId = await verifyCookie(req.cookies.access_token)

    const accoutColl = database.collection('accounts')
    const result = accoutColl.find({ user: user }, { password: 0, email: 0 })
    const doc = await result.toArray()

    if (doc.length == 1) {
        const img = doc[0].profileImg
        const bio = doc[0].bio
        const followers = doc[0].followers.length
        const following = doc[0].following.length
        const _id = doc[0]._id.toString()
        const user = doc[0].user
        let createTime = doc[0].createdAt.substring(6, 17)

        if (createTime.includes('Jan')) createTime = createTime.replace('Jan', 'janeiro')

        else if (createTime.includes('Fev')) createTime = createTime.replace('Fev', 'fevereiro')

        else if (createTime.includes('Mar')) createTime = createTime.replace('Mar', 'março')

        else if (createTime.includes('Abr')) createTime = createTime.replace('Abr', 'abril')

        else if (createTime.includes('Mai')) createTime = createTime.replace('Mai', 'maio')

        else if (createTime.includes('Jun')) createTime = createTime.replace('Jun', 'junho')

        else if (createTime.includes('Jul')) createTime = createTime.replace('Jul', 'julho')

        else if (createTime.includes('Ago')) createTime = createTime.replace('Ago', 'agosto')

        else if (createTime.includes('Set')) createTime = createTime.replace('Set', 'setembro')

        else if (createTime.includes('Out')) createTime = createTime.replace('Out', 'outubro')

        else if (createTime.includes('Nov')) createTime = createTime.replace('Nov', 'novembro')

        else createTime = createTime.replace('Dec', 'dezembro')

        res.status(200).json({
            img: img,
            followers: followers,
            bio: bio,
            following: following,
            createdAt: createTime,
            _id: _id,
            isFollowing: doc[0].followers.includes(clientId) ? true : undefined,
            user: user

        })
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.post('/getFollows', async (req, res) => {
    const clientId = await verifyCookie(req.cookies.access_token)
    const requestedId = req.body.requestedId
    const data = req.body.data

    const accoutColl = database.collection('accounts')
    const arr = []

    if (data == 'followers') {
        const result = accoutColl.find({ _id: new ObjectId(requestedId) }, { followers: 1 })
        const doc = await result.toArray()

        if (doc[0].followers.includes(clientId)) {
            const result2 = accoutColl.find({ _id: new ObjectId(clientId) }).project({ bio: 1, user: 1, profileImg: 1, _id: 1 })
            const doc2 = await result2.toArray()
            arr.push(doc2[0])
        }

        for await (userId of doc[0].followers) {
            if (userId != clientId) {
                const result2 = accoutColl.find({ _id: new ObjectId(userId) }).project({ bio: 1, user: 1, profileImg: 1, _id: 1, following: 1 })
                const doc2 = await result2.toArray()

                const result3 = accoutColl.find({ _id: new ObjectId(clientId) }).project({ following: 1 })
                const doc3 = await result3.toArray()

                if (doc2[0].following.includes(clientId)) doc2[0]['isFollowingMe'] = true

                if (doc3[0].following.includes(userId)) doc2[0]['isFollowing'] = true

                delete doc2[0]['following']

                arr.push(doc2[0])
            }
        }
    }

    else {
        const result = accoutColl.find({ _id: new ObjectId(requestedId) }, { following: 1 })
        const doc = await result.toArray()

        if (doc[0].following.includes(clientId)) {
            const result2 = accoutColl.find({ _id: new ObjectId(clientId) }).project({ bio: 1, user: 1, profileImg: 1, _id: 1 })
            const doc2 = await result2.toArray()
            arr.push(doc2[0])
        }

        for await (userId of doc[0].following) {
            if (userId != clientId) {
                const result2 = accoutColl.find({ _id: new ObjectId(userId) }).project({ bio: 1, user: 1, profileImg: 1, _id: 1, following: 1 })
                const doc2 = await result2.toArray()

                const result3 = accoutColl.find({ _id: new ObjectId(clientId) }).project({ following: 1 })
                const doc3 = await result3.toArray()

                if (doc2[0].following.includes(clientId)) doc2[0]['isFollowingMe'] = true

                if (doc3[0].following.includes(userId)) doc2[0]['isFollowing'] = true

                delete doc2[0]['following']

                arr.push(doc2[0])
            }
        }
    }

    res.status(200).json({
        result: arr
    })
})

app.post('/updateAccout', async (req, res) => {
    const newProfileImage = req.body.newProfileImage
    const newUser = req.body.newUser
    const newBio = req.body.newBio
    const userId = await verifyCookie(req.cookies.access_token)

    const accountColl = database.collection('accounts')
    const doc = await accountColl.find({ user: newUser }).project({ _id: 1 }).toArray()

    if (doc.length == 0 || userId == doc[0]._id.toString()) {
        await accountColl.updateOne({ _id: new ObjectId(userId) }, { $set: { profileImg: newProfileImage, user: newUser, bio: newBio } })

        res.status(200).json({
            status: 'success'
        })
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.post('/updateFollow', async (req, res) => {
    const clientId = await verifyCookie(req.cookies.access_token)
    const destinyId = req.body.destinyId
    const action = req.body.action
    const accoutColl = database.collection('accounts')

    const clientResult = accoutColl.find({ _id: new ObjectId(clientId) })
    const destinyResult = accoutColl.find({ _id: new ObjectId(destinyId) })

    const clientDoc = await clientResult.toArray()
    const destinyDoc = await destinyResult.toArray()

    const date = new Date()
    const months = ['Jan', 'Fev', 'Mai', 'Abr', 'Mar', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dec']

    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    let hours = date.getHours()
    let minutes = date.getMinutes()

    if (hours < 10) hours = '0' + hours

    if (minutes < 10) minutes = '0' + minutes

    const createTime = `${day} de ${months[month]} de ${year} · ${hours}:${minutes}`

    if (action == 'add' && (!clientDoc[0].following.includes(destinyId) && !destinyDoc[0].followers.includes(clientDoc[0]._id.toString()))) {
        await accoutColl.updateOne({ _id: new ObjectId(clientId) }, { $set: { following: [...clientDoc[0].following, destinyId] } })
        await accoutColl.updateOne({ _id: new ObjectId(destinyId) }, { $set: { followers: [...destinyDoc[0].followers, clientDoc[0]._id.toString()], notifications: [...destinyDoc[0].notifications, { type: 'follow', message: 'começou a te seguir', unread: true, time: createTime, clientId: clientId }] } })
    }

    else if (action == 'remove' && (clientDoc[0].following.includes(destinyId) && destinyDoc[0].followers.includes(clientDoc[0]._id.toString()))) {
        clientDoc[0].following.splice(clientDoc[0].following.indexOf(destinyId), 1)
        destinyDoc[0].followers.splice(destinyDoc[0].followers.indexOf(clientDoc[0]._id.toString()), 1)

        await accoutColl.updateOne({ _id: new ObjectId(clientId) }, { $set: { following: clientDoc[0].following } })
        await accoutColl.updateOne({ _id: new ObjectId(destinyId) }, { $set: { followers: destinyDoc[0].followers } })
    }

    res.status(200).json({
        status: 'success'
    })
})

app.post('/searchUsers', async (req, res) => {
    const value = req.body.value

    const accoutColl = database.collection('accounts')
    const result = accoutColl.find({ user: { $regex: `${value}`, $options: 'i' } }).project({ bio: 1, profileImg: 1, user: 1, _id: 0 })
    const resultDoc = await result.toArray()

    if (resultDoc.length > 4) {
        resultDoc = resultDoc.splice(3)
    }

    const arrUsers = []

    for await (const doc of resultDoc) {
        arrUsers.push(doc)
    }

    res.status(200).json({
        status: 'success',
        users: arrUsers
    })
})

app.post('/createPost', async (req, res) => {
    const userId = await verifyCookie(req.cookies.access_token)
    const text = req.body.text

    const date = new Date()
    const months = ['Jan', 'Fev', 'Mai', 'Abr', 'Mar', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dec']

    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    let hours = date.getHours()
    let minutes = date.getMinutes()

    if (hours < 10) hours = '0' + hours

    if (minutes < 10) minutes = '0' + minutes

    const createTime = `${day} de ${months[month]} de ${year} · ${hours}:${minutes}`

    const postsColl = database.collection('posts')
    const postId = await postsColl.insertOne({ userId: userId, text: text, likes: [], comments: 0, createdAt: createTime })

    if (text.match(/@[^\s]+/g) != null) {
        const accountColl = database.collection('accounts')

        text.match(/@[^\s]+/g).forEach(async (value) => {
            const user = value.replace('@', '')
            const accountResult = accountColl.find({ user: user })
            const accountDoc = await accountResult.toArray()

            if (accountDoc.length != 0) {
                const accountResult2 = accountColl.find({ _id: new ObjectId(userId) })
                const accountDoc2 = await accountResult2.toArray()

                if (user != accountDoc2[0].user) {
                    await accountColl.updateOne({ user: user }, { $set: { notifications: [...accountDoc[0].notifications, { type: 'mention', message: 'te marcou em um post', text: text, postId: postId.insertedId.toString(), unread: true, time: createTime, clientId: userId }] } })
                }
            }
        })
    }

    res.status(200).json({
        status: 'success'
    })
})

app.get('/getPosts', async (req, res) => {
    const userId = await verifyCookie(req.cookies.access_token)

    const postsColl = database.collection('posts')
    const postsResult = postsColl.find()
    const postsDoc = await postsResult.toArray()

    const accoutColl = database.collection('accounts')
    const arrPosts = []

    for await (const doc of postsDoc) {
        const userResult = accoutColl.find({ _id: new ObjectId(doc.userId) }).project({ profileImg: 1, user: 1 })
        const userDoc = await userResult.toArray()

        if (doc.likes.includes(userId)) doc['isLiked'] = true

        doc['profileImg'] = userDoc[0].profileImg
        doc['_id'] = doc._id.toString()
        doc['likes'] = doc.likes.length
        doc['createdAt'] = doc.createdAt.substring(0, 17)
        doc['user'] = userDoc[0].user

        arrPosts.unshift(doc)
    }

    res.status(200).json({
        posts: arrPosts
    })
})

app.post('/getPost', async (req, res) => {
    const id = req.body.id
    const userId = await verifyCookie(req.cookies.access_token)
    const hex = /[0-9A-Fa-f]{6}/g

    if (hex.test(id)) {
        const postsColl = database.collection('posts')
        const postResult = postsColl.find({ _id: new ObjectId(id) })
        const postDoc = await postResult.toArray()

        if (postDoc.length > 0) {
            const accountColl = database.collection('accounts')
            const accountResult = accountColl.find({ _id: new ObjectId(postDoc[0].userId) }).project({ profileImg: 1, user: 1 })
            const accountDoc = await accountResult.toArray()
            const commentsArr = []

            if (postDoc[0].comments > 0) {
                const commentsColl = database.collection('comments')
                const commentsResult = commentsColl.find({ postId: id })
                const commentsDoc = await commentsResult.toArray()

                for await (doc of commentsDoc) {
                    const profileImgResult = accountColl.find({ _id: new ObjectId(doc.userId) }).project({ profileImg: 1, user: 1 })
                    const profileImgResultDoc = await profileImgResult.toArray()

                    if (doc.likes.includes(userId)) doc['isLiked'] = true

                    doc['profileImg'] = profileImgResultDoc[0].profileImg
                    doc['likes'] = doc.likes.length
                    doc['_id'] = doc._id.toString()
                    doc['user'] = profileImgResultDoc[0].user
                    delete doc['userId']

                    commentsArr.unshift(doc)
                }
            }

            res.status(200).json({
                id: postDoc[0]._id.toString(),
                user: accountDoc[0].user,
                text: postDoc[0].text,
                likes: postDoc[0].likes.length,
                comments: postDoc[0].comments,
                profileImg: accountDoc[0].profileImg,
                createdAt: postDoc[0].createdAt,
                isLiked: postDoc[0].likes.includes(userId) ? true : undefined
            })
        }

        else {
            res.status(200).json({
                status: 'fail'
            })
        }
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.post('/getComments', async (req, res) => {
    const id = req.body.id
    const userId = await verifyCookie(req.cookies.access_token)

    const accountColl = database.collection('accounts')
    const commentsArr = []
    const commentsColl = database.collection('comments')
    const commentsResult = commentsColl.find({ postId: id })
    const commentsDoc = await commentsResult.toArray()

    for await (doc of commentsDoc) {
        const profileImgResult = accountColl.find({ _id: new ObjectId(doc.userId) }).project({ profileImg: 1, user: 1 })
        const profileImgResultDoc = await profileImgResult.toArray()

        if (doc.likes.includes(userId)) doc['isLiked'] = true

        doc['profileImg'] = profileImgResultDoc[0].profileImg
        doc['likes'] = doc.likes.length
        doc['_id'] = doc._id.toString()
        doc['user'] = profileImgResultDoc[0].user
        delete doc['userId']

        commentsArr.unshift(doc)
    }

    res.status(200).json({
        comments: commentsArr
    })
})

app.post('/createComment', async (req, res) => {
    const id = req.body.postId
    const userId = await verifyCookie(req.cookies.access_token)
    const text = req.body.text

    const date = new Date()
    const months = ['Jan', 'Fev', 'Mai', 'Abr', 'Mar', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dec']

    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    let hours = date.getHours()
    let minutes = date.getMinutes()

    if (hours < 10) hours = '0' + hours

    if (minutes < 10) minutes = '0' + minutes

    const createTime = `${day} de ${months[month]} de ${year} · ${hours}:${minutes}`

    const commentsColl = database.collection('comments')
    const commentId = await commentsColl.insertOne({ postId: id, userId: userId, text: text, likes: [], comments: 0, createdAt: createTime })

    const postsColl = database.collection('posts')
    const postResult = postsColl.find({ _id: new ObjectId(id) })
    const postDoc = await postResult.toArray()
    await postsColl.updateOne({ _id: new ObjectId(id) }, { $set: { comments: postDoc[0].comments + 1 } })

    const accountColl = database.collection('accounts')

    if (userId != postDoc[0].userId) {
        const userPost = accountColl.find({ _id: new ObjectId(postDoc[0].userId) }).project({ notifications: 1 })
        const userPostDoc = await userPost.toArray()

        await accountColl.updateOne({ _id: new ObjectId(postDoc[0].userId) }, { $set: { notifications: [...userPostDoc[0].notifications, { type: 'response', message: 'respondeu seu post', postId: id, commentId: commentId.insertedId.toString(), text: text, unread: true, time: createTime, clientId: userId }] } })
    }

    if (text.match(/@[^\s]+/g) != null) {
        text.match(/@[^\s]+/g).forEach(async (value) => {
            const user = value.replace('@', '')
            const accountResult = accountColl.find({ user: user })
            const accountDoc = await accountResult.toArray()

            if (accountDoc.length != 0) {
                const accountResult2 = accountColl.find({ _id: new ObjectId(userId) })
                const accountDoc2 = await accountResult2.toArray()

                if (user != accountDoc2[0].user) {
                    await accountColl.updateOne({ user: user }, { $set: { notifications: [...accountDoc[0].notifications, { type: 'mention', message: 'te marcou em um comentário', text: text, postId: id, commentId: commentId.insertedId.toString(), unread: true, time: createTime, clientId: userId }] } })
                }
            }
        })
    }

    res.status(200).json({
        status: 'success'
    })
})

app.post('/createReply', async (req, res) => {
    const id = req.body.commentId
    const userId = await verifyCookie(req.cookies.access_token)
    const text = req.body.text

    const date = new Date()
    const months = ['Jan', 'Fev', 'Mai', 'Abr', 'Mar', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dec']

    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    let hours = date.getHours()
    let minutes = date.getMinutes()

    if (hours < 10) hours = '0' + hours

    if (minutes < 10) minutes = '0' + minutes

    const createTime = `${day} de ${months[month]} de ${year} · ${hours}:${minutes}`

    const repliesColl = database.collection('replies')
    const result = await repliesColl.insertOne({ commentId: id, userId: userId, text: text, likes: [], createdAt: createTime })
    const commentsColl = database.collection('comments')
    const commentsResult = commentsColl.find({ _id: new ObjectId(id) })
    const commentsDoc = await commentsResult.toArray()
    await commentsColl.updateOne({ _id: new ObjectId(id) }, { $set: { comments: commentsDoc[0].comments + 1 } })

    const accountColl = database.collection('accounts')

    if (userId != commentsDoc[0].userId) {
        const userPost = accountColl.find({ _id: new ObjectId(commentsDoc[0].userId) }).project({ notifications: 1 })
        const userPostDoc = await userPost.toArray()

        await accountColl.updateOne({ _id: new ObjectId(commentsDoc[0].userId) }, { $set: { notifications: [...userPostDoc[0].notifications, { type: 'response', message: 'respondeu seu comentário', postId: commentsDoc[0].postId, text: text, commentId: id, replyId: result.insertedId.toString(), unread: true, time: createTime, clientId: userId }] } })
    }

    if (text.match(/@[^\s]+/g) != null) {
        text.match(/@[^\s]+/g).forEach(async (value) => {
            const user = value.replace('@', '')
            const accountResult = accountColl.find({ user: user })
            const accountDoc = await accountResult.toArray()

            if (accountDoc.length != 0) {
                const accountResult2 = accountColl.find({ _id: new ObjectId(userId) })
                const accountDoc2 = await accountResult2.toArray()

                if (user != accountDoc2[0].user) {
                    await accountColl.updateOne({ user: user }, { $set: { notifications: [...accountDoc[0].notifications, { type: 'mention', message: 'te marcou em uma resposta', text: text, postId: commentsDoc[0].postId, commentId: id, replyId: result.insertedId.toString(), unread: true, time: createTime, clientId: userId }] } })
                }
            }
        })
    }

    res.status(200).json({
        status: 'success',
        id: result.insertedId
    })
})

app.post('/getReplies', async (req, res) => {
    const id = req.body.id
    const userId = await verifyCookie(req.cookies.access_token)

    const repliesColl = database.collection('replies')
    const repliesResult = repliesColl.find({ commentId: id })
    const repliesDoc = await repliesResult.toArray()
    const accoutColl = database.collection('accounts')

    const arrReplies = []

    for await (doc of repliesDoc) {
        const accoutResult = accoutColl.find({ _id: new ObjectId(doc.userId) }).project({ profileImg: 1, user: 1 })
        const accoutDoc = await accoutResult.toArray()

        if (doc.likes.includes(userId)) doc['isLiked'] = true

        doc['profileImg'] = accoutDoc[0].profileImg
        doc['_id'] = doc._id.toString()
        doc['likes'] = doc.likes.length
        doc['user'] = accoutDoc[0].user
        delete doc['userId']

        arrReplies.push(doc)
    }

    res.status(200).json({
        status: 'success',
        replies: arrReplies
    })
})

app.post('/handleLike', async (req, res) => {
    const type = req.body.type
    const id = req.body.id
    const userId = await verifyCookie(req.cookies.access_token)
    const action = req.body.action

    if (action == 'add') {
        const date = new Date()
        const months = ['Jan', 'Fev', 'Mai', 'Abr', 'Mar', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dec']

        const year = date.getFullYear()
        const month = date.getMonth()
        const day = date.getDate()
        let hours = date.getHours()
        let minutes = date.getMinutes()

        if (hours < 10) hours = '0' + hours

        if (minutes < 10) minutes = '0' + minutes

        const createTime = `${day} de ${months[month]} de ${year} · ${hours}:${minutes}`

        if (type == 'post') {
            const postsColl = database.collection('posts')
            const postsResult = postsColl.find({ _id: new ObjectId(id) }).project({ likes: 1, userId: 1, text: 1 })
            const postsDoc = await postsResult.toArray()

            if (!postsDoc[0].likes.includes(userId)) {
                const accountColl = database.collection('accounts')
                const accountResult = accountColl.find({ _id: new ObjectId(userId) }).project({ likes: 1, user: 1, profileImg: 1 })
                const accountDoc = await accountResult.toArray()
                await accountColl.updateOne({ _id: new ObjectId(userId) }, { $set: { likes: [...accountDoc[0].likes, { type: type, id: id }] } })
                await postsColl.updateOne({ _id: new ObjectId(id) }, { $set: { likes: [...postsDoc[0].likes, userId] } })

                if (userId != postsDoc[0].userId) {
                    const accountResult2 = accountColl.find({ _id: new ObjectId(postsDoc[0].userId) }).project({ notifications: 1 })
                    const accountDoc2 = await accountResult2.toArray()
                    await accountColl.updateOne({ _id: new ObjectId(postsDoc[0].userId) }, { $set: { notifications: [...accountDoc2[0].notifications, { type: 'like', message: 'curtiu seu post', postId: id, unread: true, time: createTime, text: postsDoc[0].text, clientId: userId }] } })
                }
            }
        }

        else if (type == 'comment') {
            const commentsColl = database.collection('comments')
            const commentsResult = commentsColl.find({ _id: new ObjectId(id) }).project({ likes: 1, userId: 1, postId: 1, text: 1 })
            const commentsDoc = await commentsResult.toArray()

            if (!commentsDoc[0].likes.includes(userId)) {
                const accountColl = database.collection('accounts')
                const accountResult = accountColl.find({ _id: new ObjectId(userId) }).project({ likes: 1, user: 1, profileImg: 1 })
                const accountDoc = await accountResult.toArray()
                await accountColl.updateOne({ _id: new ObjectId(userId) }, { $set: { likes: [...accountDoc[0].likes, { type: type, id: id }] } })
                await commentsColl.updateOne({ _id: new ObjectId(id) }, { $set: { likes: [...commentsDoc[0].likes, userId] } })

                if (userId != commentsDoc[0].userId) {
                    const accountResult2 = accountColl.find({ _id: new ObjectId(commentsDoc[0].userId) }).project({ notifications: 1 })
                    const accountDoc2 = await accountResult2.toArray()
                    await accountColl.updateOne({ _id: new ObjectId(commentsDoc[0].userId) }, { $set: { notifications: [...accountDoc2[0].notifications, { type: 'like', message: 'curtiu seu comentário', postId: commentsDoc[0].postId, commentId: id, unread: true, time: createTime, text: commentsDoc[0].text, clientId: userId }] } })
                }
            }
        }

        else {
            const repliesColl = database.collection('replies')
            const repliesResult = repliesColl.find({ _id: new ObjectId(id) }).project({ likes: 1, userId: 1, commentId: 1, text: 1 })
            const repliesDoc = await repliesResult.toArray()

            if (!repliesDoc[0].likes.includes(userId)) {
                const accountColl = database.collection('accounts')
                const accountResult = accountColl.find({ _id: new ObjectId(userId) }).project({ likes: 1, user: 1, profileImg: 1 })
                const accountDoc = await accountResult.toArray()
                await accountColl.updateOne({ _id: new ObjectId(userId) }, { $set: { likes: [...accountDoc[0].likes, { type: type, id: id }] } })
                await repliesColl.updateOne({ _id: new ObjectId(id) }, { $set: { likes: [...repliesDoc[0].likes, userId] } })

                if (userId != repliesDoc[0].userId) {
                    const commentColl = database.collection('comments')
                    const commentsResult = commentColl.find({ _id: new ObjectId(repliesDoc[0].commentId) }).project({ postId: 1 })
                    const commentsDoc = await commentsResult.toArray()

                    const accountResult2 = accountColl.find({ _id: new ObjectId(repliesDoc[0].userId) }).project({ notifications: 1 })
                    const accountDoc2 = await accountResult2.toArray()
                    await accountColl.updateOne({ _id: new ObjectId(repliesDoc[0].userId) }, { $set: { notifications: [...accountDoc2[0].notifications, { type: 'like', message: 'curtiu sua resposta', postId: commentsDoc[0].postId, commentId: repliesDoc[0].commentId, replyId: id, unread: true, time: createTime, text: repliesDoc[0].text, clientId: userId }] } })
                }
            }
        }
    }

    else {
        if (type == 'post') {
            const postsColl = database.collection('posts')
            const postsResult = postsColl.find({ _id: new ObjectId(id) }).project({ likes: 1 })
            const postsDoc = await postsResult.toArray()

            if (postsDoc[0].likes.includes(userId)) {
                const accountColl = database.collection('accounts')
                await accountColl.updateOne({ _id: new ObjectId(userId) }, { $pull: { likes: { type: type, id: id } } })

                await postsColl.updateOne({ _id: new ObjectId(id) }, { $pull: { likes: userId } })
            }
        }

        else if (type == 'comment') {
            const commentsColl = database.collection('comments')
            const commentsResult = commentsColl.find({ _id: new ObjectId(id) }).project({ likes: 1 })
            const commentsDoc = await commentsResult.toArray()

            if (commentsDoc[0].likes.includes(userId)) {
                const accountColl = database.collection('accounts')
                await accountColl.updateOne({ _id: new ObjectId(userId) }, { $pull: { likes: { type: type, id: id } } })

                await commentsColl.updateOne({ _id: new ObjectId(id) }, { $pull: { likes: userId } })
            }
        }

        else {
            const repliesColl = database.collection('replies')
            const repliesResult = repliesColl.find({ _id: new ObjectId(id) }).project({ likes: 1 })
            const repliesDoc = await repliesResult.toArray()

            if (repliesDoc[0].likes.includes(userId)) {
                const accountColl = database.collection('accounts')
                await accountColl.updateOne({ _id: new ObjectId(userId) }, { $pull: { likes: { type: type, id: id } } })

                await repliesColl.updateOne({ _id: new ObjectId(id) }, { $pull: { likes: userId } })
            }
        }
    }

    res.status(200).json({
        status: 'success'
    })
})

app.get('/userPosts/:userId', async (req, res) => {
    const clientId = await verifyCookie(req.cookies.access_token)
    const userId = req.params.userId

    const postColl = database.collection('posts')
    const postResult = postColl.find({ userId: userId })
    const postDoc = await postResult.toArray()
    const accountColl = database.collection('accounts')

    if (postDoc.length > 0) {
        const arrPosts = []

        for await (doc of postDoc) {
            const accountResult = accountColl.find({ _id: new ObjectId(doc.userId) }).project({ profileImg: 1, user: 1 })
            const accountDoc = await accountResult.toArray()

            if (doc.likes.includes(clientId)) doc['isLiked'] = true

            doc['likes'] = doc.likes.length
            doc['profileImg'] = accountDoc[0].profileImg
            doc['user'] = accountDoc[0].user

            delete doc['userId']

            arrPosts.unshift(doc)
        }

        res.status(200).json({
            posts: arrPosts
        })
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.get('/userComments/:userId', async (req, res) => {
    const userId = req.params.userId
    const clientId = await verifyCookie(req.cookies.access_token)

    const commentsColl = database.collection('comments')
    const commentsResult = commentsColl.find({ userId: userId })
    const commentsDoc = await commentsResult.toArray()
    const accountColl = database.collection('accounts')

    if (commentsDoc.length > 0) {
        const arrComments = []

        for await (doc of commentsDoc) {
            const accountResult = accountColl.find({ _id: new ObjectId(doc.userId) }).project({ profileImg: 1, user: 1 })
            const accountDoc = await accountResult.toArray()

            if (doc.likes.includes(clientId)) doc['isLiked'] = true

            doc['likes'] = doc.likes.length
            doc['profileImg'] = accountDoc[0].profileImg
            doc['user'] = accountDoc[0].user

            delete doc['userId']

            arrComments.unshift(doc)
        }

        res.status(200).json({
            comments: arrComments
        })
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.get('/userReplies/:userId', async (req, res) => {
    const userId = req.params.userId
    const clientId = await verifyCookie(req.cookies.access_token)

    const repliesColl = database.collection('replies')
    const repliesResult = repliesColl.find({ userId: userId })
    const repliesDoc = await repliesResult.toArray()
    const accountColl = database.collection('accounts')

    if (repliesDoc.length > 0) {
        const arrReplies = []

        for await (doc of repliesDoc) {
            const accountResult = accountColl.find({ _id: new ObjectId(doc.userId) }).project({ profileImg: 1, user: 1 })
            const accountDoc = await accountResult.toArray()

            const commentsColl = database.collection('comments')
            const commentsResult = commentsColl.find({ _id: new ObjectId(doc.commentId) }).project({ postId: 1 })
            const commentsDoc = await commentsResult.toArray()

            if (doc.likes.includes(clientId)) doc['isLiked'] = true

            doc['postId'] = commentsDoc[0].postId
            doc['likes'] = doc.likes.length
            doc['profileImg'] = accountDoc[0].profileImg
            doc['user'] = accountDoc[0].user

            delete doc['userId']

            arrReplies.unshift(doc)
        }

        res.status(200).json({
            replies: arrReplies
        })
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.get('/userLikes/:userId', async (req, res) => {
    const userId = await verifyCookie(req.cookies.access_token)

    const accountColl = database.collection('accounts')
    const accountResult = accountColl.find({ _id: new ObjectId(userId) }).project({ likes: 1 })
    const accountDoc = await accountResult.toArray()

    if (accountDoc[0].likes.length > 0) {
        const arrLikes = []

        for await (doc of accountDoc[0].likes) {
            if (doc.type == 'post') {
                const postsColl = database.collection('posts')
                const postsResult = postsColl.find({ _id: new ObjectId(doc.id) })
                const postsDoc = await postsResult.toArray()

                const profileImgResult = accountColl.find({ _id: new ObjectId(postsDoc[0].userId) }).project({ profileImg: 1, user: 1 })
                const profileImgDoc = await profileImgResult.toArray()

                postsDoc[0]['likes'] = postsDoc[0].likes.length
                postsDoc[0]['isLiked'] = true
                postsDoc[0]['profileImg'] = profileImgDoc[0].profileImg
                postsDoc[0]['user'] = profileImgDoc[0].user

                delete postsDoc[0]['userId']

                arrLikes.unshift(postsDoc[0])
            }

            else if (doc.type == 'comment') {
                const commentsColl = database.collection('comments')
                const commentsResult = commentsColl.find({ _id: new ObjectId(doc.id) })
                const commentsDoc = await commentsResult.toArray()

                const profileImgResult = accountColl.find({ _id: new ObjectId(commentsDoc[0].userId) }).project({ profileImg: 1, user: 1 })
                const profileImgDoc = await profileImgResult.toArray()

                commentsDoc[0]['likes'] = commentsDoc[0].likes.length
                commentsDoc[0]['isLiked'] = true
                commentsDoc[0]['profileImg'] = profileImgDoc[0].profileImg
                commentsDoc[0]['user'] = profileImgDoc[0].user

                delete commentsDoc[0]['userId']

                arrLikes.unshift(commentsDoc[0])
            }

            else {
                const repliesColl = database.collection('replies')
                const repliesResult = repliesColl.find({ _id: new ObjectId(doc.id) })
                const repliesDoc = await repliesResult.toArray()

                const profileImgResult = accountColl.find({ _id: new ObjectId(repliesDoc[0].userId) }).project({ profileImg: 1, user: 1 })
                const profileImgDoc = await profileImgResult.toArray()

                const commentsColl = database.collection('comments')
                const commentsResult = commentsColl.find({ _id: new ObjectId(repliesDoc[0].commentId) }).project({ postId: 1 })
                const commentsDoc = await commentsResult.toArray()

                repliesDoc[0]['likes'] = repliesDoc[0].likes.length
                repliesDoc[0]['isLiked'] = true
                repliesDoc[0]['profileImg'] = profileImgDoc[0].profileImg
                repliesDoc[0]['postId'] = commentsDoc[0].postId
                repliesDoc[0]['user'] = profileImgDoc[0].user

                delete repliesDoc[0]['userId']

                arrLikes.unshift(repliesDoc[0])
            }
        }

        res.status(200).json({
            likes: arrLikes
        })
    }

    else {
        res.status(200).json({
            status: 'fail'
        })
    }
})

app.get('/notifications', async (req, res) => {
    const userId = await verifyCookie(req.cookies.access_token)

    const accountColl = database.collection('accounts')
    const accountResult = accountColl.find({ _id: new ObjectId(userId) }).project({ notifications: 1 })
    const accountDoc = await accountResult.toArray()
    const arr = []

    for await (doc of accountDoc[0].notifications) {
        const accountResult2 = accountColl.find({ _id: new ObjectId(doc.clientId) }).project({ user: 1, profileImg: 1 })
        const accountDoc2 = await accountResult2.toArray()

        doc['time'] = doc.time.substring(0, 11) + ' ' + doc.time.substring(12, 17)
        doc['clientImg'] = accountDoc2[0].profileImg
        doc['message'] = accountDoc2[0].user + ' ' + doc.message

        if (doc.type == 'follow') doc['user'] = accountDoc2[0].user

        delete doc['clientId']

        arr.unshift(doc)
    }

    await accountColl.updateOne({ _id: new ObjectId(userId) }, { $set: { 'notifications.$[element].unread': false } }, { arrayFilters: [{ 'element.unread': true }] })

    res.status(200).json({
        notifications: arr
    })
})