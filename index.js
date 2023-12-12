const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Doctors portal server running...');
})




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.pw2gnqu.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(403).send('unauthorized token');
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (error, decoded) {
        if (error) {
            return res.status(403).send({ message: 'access forbidden' });
        }
        req.decoded = decoded;
        next();
    })
}


async function run() {
    try {
        const treatmentCollections = client.db('doctors-portal').collection('treatment');
        const bookingsCollections = client.db('doctors-portal').collection('bookings');
        const usersCollections = client.db('doctors-portal').collection('users');
        const doctorsCollections = client.db('doctors-portal').collection('doctors');

        app.get('/treatment', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const treatments = await treatmentCollections.find(query).toArray();

            const bookingQuery = { date };
            const alreadyBooked = await bookingsCollections.find(bookingQuery).toArray();

            treatments.forEach(treatment => {
                const treatmentBooked = alreadyBooked.filter(book => book.treatmentName === treatment.name);
                const bookedSlots = treatmentBooked.map(book => book.slot);
                const remainintSlots = treatment.slots.filter(slot => !bookedSlots.includes(slot));
                treatment.slots = remainintSlots;
            })

            res.send(treatments);
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                date: booking.date,
                email: booking.email,
                treatmentName: booking.treatmentName
            }
            const alreadyBooked = await bookingsCollections.find(query).toArray();

            if (alreadyBooked.length) {
                const message = `You already have a booking on ${booking.date}`;
                return res.send({ acknowledged: false, message });
            }
            else {
                const result = await bookingsCollections.insertOne(booking);
                res.send(result);
            }
        })

        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const appointments = await bookingsCollections.find(query).toArray();
            res.send(appointments);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollections.insertOne(user);
            res.send(result);
        })

        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollections.find(query).toArray();
            res.send(users);
        })

        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollections.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Access forbidden' });
            }

            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollections.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollections.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollections.deleteOne(query);
            res.send(result);
        })

        app.get('/doctorSpecialty', async(req, res)=>{
            const query = {};
            const specialty = await treatmentCollections.find(query).project({name : 1}).toArray();
            res.send(specialty);
        })

        app.post('/doctor', async(req, res)=>{
            const doctor = req.body;
            const result = await doctorsCollections.insertOne(doctor);
            res.send(result);
        })

        app.get('/doctor', async(req, res)=>{
            res.send(await doctorsCollections.find({}).toArray());
        })

        app.delete('/doctor/:id', async(req, res)=>{
            const id = req.params.id;
            const query = { _id : new ObjectId(id)};
            const result = await doctorsCollections.deleteOne(query);
            res.send(result);
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollections.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '5d' });
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' });
        })
    }
    finally {

    }
}
run().catch(err => console.log(err));


app.listen(port, () => { console.log(`server running on port: ${port}`); })