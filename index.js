import express from "express";
import cors from "cors";
const app = express();

import 'dotenv/config'
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

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
const usersCollection = db.collection('user');
const eventJoinedCollection = db.collection('event_joined');


// Token verify
const tokenVerify = async(req, res, next)=>{
    const authHeaders = req.headers.authorization;

    if(!authHeaders){
        return res.status(401).send({msg: "Unauthorized!"});
    }

    const token = authHeaders.split(" ")[1];

    if(!token){
        return res.status(401).send({msg: "Unauthorized!"});
    }

    const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
    
    try {
        const {payload} = await jwtVerify(token, JWKS);
        next();
    } catch (error) {
        return res.status(500).send({msg: "Sever errors!"});
    }
}


app.get('/', (req, res) =>{
    res.send({msg:"hello check"});
});


//http://localhost:8000/

//-- Check if a user already joined an event -- http://localhost:8000/user/event-joined?userId=...&eventId=...

app.get('/user/event-joined',tokenVerify, async(req, res)=>{
    const { userId, eventId } = req.query;

    if (!userId || !eventId) {
        return res.status(400).send({ message: "userId and eventId are required" });
    }

    try {
        const existing = await eventJoinedCollection.findOne({
            userId: String(userId),
            eventId: String(eventId)
        });

        res.send({ joined: !!existing });
    } catch (error) {
        res.status(500).send({ message: "Failed to check join status" });
    }
})


//-- Get user by user id
app.get('/user/:userId',tokenVerify, async(req, res)=>{
    const {userId} = req.params;
    const result = await usersCollection.findOne({_id: new ObjectId(userId)});
    res.send(result);
})


//-- Get User Events -- http://localhost:8000/users/:userId/events
app.get('/users/:userId/events',tokenVerify, async(req, res) => {
    const {userId} = req.params;
    const result = await eventsCollection.find({user_id:userId}).toArray();
    res.send(result);
});

//-- Create New Event -- http://localhost:8000/event
app.post('/event',tokenVerify, async(req, res) => {
    const newEvent = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await eventsCollection.insertOne(newEvent);
    res.send(result);
});


//-- Gell latest 6 events -- http://localhost:8000/latest-events
app.get('/latest-events',tokenVerify, async(req, res)=>{
    const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Dhaka",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());

    const result = await eventsCollection.find({eventDate: {$gt: today}}).sort({createdAt: -1}).limit(6).toArray();
    res.send(result);
})


// Get All Events -- http://localhost:8000/events
app.get('/events', tokenVerify, async (req, res) => {
    try {
        const { search, eventType, sort, status } = req.query;

        // Filter object
        const filter = {};

        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Dhaka",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());

        // Search by title, location or description
        if (search) {
            filter.$or = [
                { eventTitle: { $regex: search, $options: "i" } },
            ];
        }

        // Filter by event type
        if (eventType && eventType !== "all") {
            filter.eventType = {
                $regex: `^${eventType}$`,
                $options: "i"
            };
        }


          // Filter by event status
        if (status === "upcoming") {
            filter.eventDate = { $gt: today };
        }

        if (status === "completed") {
            filter.eventDate = { $lt: today };
        }

        if (status === "ongoing") {
            filter.eventDate = today;
        }

        // Sorting
        let sortOption = { createdAt: -1 }; // Latest first

        if (sort === "earliest") {
            sortOption = { createdAt: 1 };
        }

        if (sort === "latest") {
            sortOption = { createdAt: -1 };
        }

        const result = await eventsCollection
            .find(filter)
            .sort(sortOption)
            .toArray();

        res.send(result);

    } catch (error) {
        res.status(500).send({
            message: "Failed to fetch events",
            error: error.message
        });
    }
});


// Delete event by id 
app.delete('/event/:Id', tokenVerify, async(req, res)=>{
    const {Id} = req.params;

    if (!ObjectId.isValid(Id)) {
        return res.status(400).send({ message: "Invalid event id" });
    }

    try {
        const result = await eventsCollection.deleteOne({_id: new ObjectId(Id)});
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to delete event" });
    }
})


// Event Update 
app.patch('/event/:Id', tokenVerify, async(req, res) => {
    const {Id} = req.params;

    if (!ObjectId.isValid(Id)) {
        return res.status(400).send({ message: "Invalid event id" });
    }

    const { eventTitle, eventType, eventDate, location, imageUrl, eventDescription } = req.body;

    const updateData = {};
    if (eventTitle !== undefined) updateData.eventTitle = eventTitle;
    if (eventType !== undefined) updateData.eventType = eventType;
    if (eventDate !== undefined) updateData.eventDate = eventDate;
    if (location !== undefined) updateData.location = location;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (eventDescription !== undefined) updateData.eventDescription = eventDescription;

    try {
        const result = await eventsCollection.updateOne(
            {_id: new ObjectId(Id)},
            { $set: { ...updateData, updatedAt: new Date() } }
        );

        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to update event" });
    }
})


// Get event by id -- http://localhost:8000/events/id
app.get('/events/:id', tokenVerify, async(req, res) =>{
    const {id} = req.params;
    const result = await eventsCollection.findOne({_id: new ObjectId(id)});
    res.send(result);
})




// =============== Event Joined

//-- Join an event (one user can join an event only once)
app.post('/user/event-joined', tokenVerify, async(req, res)=>{
    const { eventId, userId, status } = req.body;

    if (!eventId || !userId) {
        return res.status(400).send({ message: "eventId and userId are required" });
    }

    try {
        const existing = await eventJoinedCollection.findOne({
            userId: String(userId),
            eventId: String(eventId)
        });

        if (existing) {
            return res.status(409).send({
                message: "You have already joined this event",
                alreadyJoined: true
            });
        }

        const newData = {
            eventId: String(eventId),
            userId: String(userId),
            status: status || "joined",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await eventJoinedCollection.insertOne(newData);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to join event" });
    }
})

app.get("/user/event-joined", tokenVerify, async (req, res) => {
    try {
        const { userId, eventId } = req.query;

        if (!userId || !eventId) {
            return res.status(400).send({
                message: "User ID and Event ID are required"
            });
        }

        const result = await eventJoinedCollection.findOne({
            userId: userId,
            eventId: eventId,
            status: "joined"
        });

        res.send({
            joined: !!result
        });

    } catch (error) {
        res.status(500).send({
            message: "Failed to check join status"
        });
    }
});

//-- Get joined user by user id
app.get('/user/event-joined/:userId', tokenVerify, async(req, res) =>{
    const {userId} = req.params;
    const result = await eventJoinedCollection.find({userId:userId}).toArray();
    res.send(result);
})


// Delete joined event by id & userId
app.delete('/user/event-joined/:Id/:userId', tokenVerify, async(req, res) =>{
    const {Id, userId} = req.params;

    if (!ObjectId.isValid(Id)) {
        return res.status(400).send({ message: "Invalid event id" });
    }

    const result = await eventJoinedCollection.deleteOne({_id: new ObjectId(Id), userId:userId});
    res.send(result);
})



app.get("/dashboard/statistics", tokenVerify, async (req, res) => {
    try {
        // Get today's date in Bangladesh timezone
        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Dhaka",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());

        // Total events
        const totalEvents = await eventsCollection.countDocuments();

        // Upcoming events
        const upcomingEvents = await eventsCollection.countDocuments({
            eventDate: { $gt: today }
        });

        // Completed events
        const completedEvents = await eventsCollection.countDocuments({
            eventDate: { $lt: today }
        });

        // Active volunteers (unique users who joined events)
        const activeVolunteers = await eventJoinedCollection.distinct(
            "userId",
            { status: "joined" }
        );

        res.status(200).send({
            success: true,
            statistics: {
                totalUpcomingEvents: upcomingEvents,
                totalCompletedEvents: completedEvents,
                totalActiveVolunteers: activeVolunteers.length,
                totalEvents: totalEvents
            }
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            message: "Failed to fetch dashboard statistics"
        });
    }
});


app.get("/events/:eventId/join-count", tokenVerify, async(req, res) =>{
    const {eventId} = req.params;
    const totalJoined  = await eventJoinedCollection.countDocuments({
        eventId: String(eventId),
        status: "joined"
    });

    res.send(totalJoined);
})


app.listen(PORT, ()=>{
    console.log(`web server listening on port ${PORT}`);
})


export default app;