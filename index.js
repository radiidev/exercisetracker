const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const PORT = process.env.PORT || 16749;
const MONGODB_URI = process.env.MONGODB_URI || "";

mongoose.connect(MONGODB_URI, {
  // @ts-ignore
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const exerciseLogsSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [
    {
      description: { type: String, required: true },
      duration: { type: Number, required: true },
      date: { type: String, required: true },
    },
  ],
});

const exerciseLogs = mongoose.model("ExerciseLogs", exerciseLogsSchema);

app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.post("/api/users", (req, res) => {
  const username = req.body.username;
  const exerciseLogsModel = new exerciseLogs({ username: username });
  exerciseLogsModel
    .save()
    .then((user) => {
      if (user) return res.json({ username: user.username, _id: user._id });
      res.status(500);
      res.json({ error: `Error creating user: ${username}` });
    })
    .catch((err) => {
      res.status(500);
      return res.json({
        error: `Error type 2 while creating user: ${username}`,
      });
    });
});

app.get("/api/users", (req, res) => {
  exerciseLogs
    .find()
    .select({ username: true, _id: true })
    .exec()
    .then((users) => {
      res.json(users);
    })
    .catch((err) => {
      res.sendStatus(500);
      res.json({ error: `Error while retrieving users list:\n${err}` });
    });
});

app.post("/api/users/:_id/exercises", (req, res) => {
  const _id = req.params._id;
  const description = req.body.description;
  const duration = req.body.duration;
  const date = req.body.date ? req.body.date : new Date().toDateString();
  exerciseLogs
    .exists({ _id: _id })
    .then((userExists) => {
      if (userExists) {
        exerciseLogs
          .updateOne(
            { _id: _id },
            {
              $push: {
                log: {
                  description: description,
                  duration: duration,
                  date: date,
                },
              },
            },
            { runValidators: true }
          )
          .then((excLogs) => {
            if (excLogs.modifiedCount) {
              res.json({
                _id: _id,
                description: description,
                duration: duration,
                date: date,
              });
            } else {
              res.json(500);
              res.json({
                error: `Failed to add exercise logs to database:\n${excLogs}`,
              });
            }
          })
          .catch((err) => {
            res.status(500);
            res.json({
              error: `Failed to add exercise logs to database:\n${err}`,
            });
          });
      } else {
        res.status(403);
        res.json({ error: `No user with id: ${_id} exists` });
      }
    })
    .catch((err) => {
      res.status(500);
      res.json({ error: "Failed to check user in database" });
    });
});

const listener = app.listen(PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
