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
      date: { type: Number, required: true },
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

const getDateInTicks = (date) => {
  // current time in tick if no date specified
  if (!date) date = new Date().getTime();
  // Convert String to Number if date specified in ticks
  if (!Number.isNaN(Number(date))) date = Number(date);
  // get date ticks from ticks Number or date String
  date = new Date(date).getTime();
  // date will be NaN if invalid date String is provided
  return date;
};

app.post("/api/users/:_id/exercises", (req, res) => {
  const _id = req.params._id;
  const description = req.body.description;
  const duration = Number(req.body.duration);

  let date = getDateInTicks(req.body.date);
  if (Number.isNaN(Number(date))) {
    res.status(400);
    return res.json({ error: `Input date: '${req.body.date}' is not valid` });
  }

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
                date: new Date(date).toDateString(),
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

app.get("/api/users/:_id/logs", (req, res) => {
  const _id = req.params._id;
  const limit = req.query.limit
    ? Math.trunc(Number(req.query.limit))
    : Number.MAX_SAFE_INTEGER;
  if (Number.isNaN(limit)) {
    res.status(400);
    return res.json({
      error: `Query key 'limit''s value '${req.query.limit}' is not a number`,
    });
  }
  const from = req.query.from ? getDateInTicks(req.query.from) : 0;
  if (Number.isNaN(from)) {
    res.status(400);
    return res.json({
      error: `Query key 'from''s value '${req.query.from}' is invalid for date`,
    });
  }
  const to = req.query.to
    ? getDateInTicks(req.query.to)
    : Number.MAX_SAFE_INTEGER;
  if (Number.isNaN(to)) {
    res.status(400);
    return res.json({
      error: `Query key 'to''s value '${req.query.to}' is invalid for date`,
    });
  }
  exerciseLogs
    .findById(_id)
    .select({ "log._id": false, __v: false })
    .then((excLogs) => {
      if (excLogs) {
        let excLogsJson = excLogs.toJSON();
        excLogsJson.log = excLogsJson.log.filter(
          (log) => log.date >= from && log.date <= to
        );
        excLogsJson.log.sort((a, b) => a.date - b.date);
        excLogsJson.log = excLogsJson.log.slice(0, limit);
        excLogsJson.count = excLogsJson.log.length;
        excLogsJson.log = excLogsJson.log.map((log) => {
          log.date = new Date(log.date).toDateString();
          return log;
        });
        return res.json(excLogsJson);
      }
      res.status(400);
      res.json({ error: `No user with id: '${_id}' exists` });
    })
    .catch((err) => {
      res.status(400);
      res.json({ error: `Input user id: '${_id}' is malformed` });
    });
});

const listener = app.listen(PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
