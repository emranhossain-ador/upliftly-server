import express from "express";
import cors from "cors";
const app = express();

import 'dotenv/config'
import { MongoClient } from "mongodb";

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

//-- Create New Event -- http://localhost:8000/event
app.post('/event', (req, res) => {
    const newEvent = req.body;
    const result = eventsCollection.insertOne(newEvent);
    res.send(result);
});





app.listen(PORT, ()=>{
    console.log(`web server listening on port ${PORT}`);
})