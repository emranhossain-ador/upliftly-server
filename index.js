import express from "express";
import cors from "cors";
const app = express();

import 'dotenv/config'
import { MongoClient, ObjectId } from "mongodb";

const PORT = 8000;

app.use(cors());
app.use(express.json());

// connect with database
const client = new MongoClient(process.env.MONGODB_AUTH_URL);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
 
const connetClient = await connectToMongoDB();
const db = connetClient.db("upliftlydb");
const eventsCollection = db.collection('events_list');



app.get('/', (req, res) =>{
    res.send({msg:"hello check"});
});


//http://localhost:8000/

//-- Get User Events -- http://localhost:8000/users/:userId/events
app.get('/users/:userId/events', async(req, res) => {
    const {userId} = req.params;
    const result = await eventsCollection.find({user_id:userId}).toArray();
    res.send(result);
});

//-- Create New Event -- http://localhost:8000/event
app.post('/event', async(req, res) => {
    const newEvent = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await eventsCollection.insertOne(newEvent);
    res.send(result);
});


//-- Gell latest 6 events -- http://localhost:8000/latest-events
app.get('/latest-events', async(req, res)=>{
    const result = await eventsCollection.find().sort({createdAt: -1}).limit(6).toArray();
    res.send(result);
})


// Get All Events -- http://localhost:8000/events
app.get('/events', async(req, res) =>{
    const result = await eventsCollection.find().sort({createdAt:-1}).toArray();
    res.send(result);
})


// Get event by id -- http://localhost:8000/events/id
app.get('/events/:id', async(req, res) =>{
    const {id} = req.params;
    const result = await eventsCollection.findOne({_id: new ObjectId(id)});
    res.send(result);
})



app.listen(PORT, ()=>{
    console.log(`web server listening on port ${PORT}`);
})


export default app;