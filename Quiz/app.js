require("dotenv").config();
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const http = require("http");
const session = require("express-session");
const sendMail = require("./sendMail");

//web Sockets
const socket = require("socket.io");
const { disconnect, emit } = require("process");
const server = http.createServer(app);
const io = socket(server);

const IO = require("socket.io-client");

//database and Schemas

const userSchema = new mongoose.Schema({
  userName: String,
  name: String,
  password: String,
  mail: String,
  quizTaken: [
    {
      quizID: String,
      quizName: String,
      quizScore: Number,
      totalQues: Number,
      submitTime: String,
    },
  ],
  quizMade: [String],
});

const user = mongoose.model("user", userSchema);

const quizIDs = mongoose.model(
  "quizID",
  mongoose.Schema({}, { strict: false })
);

var dbConnector = process.env.DB_CONNECTOR;

const port = process.env.PORT;

server.listen(port, () => {
  console.log("Server running on port 3000");
});

mongoose
  .connect(dbConnector, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("connected Succussfull"))
  .catch((err) => console.log(err));

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(
  session({
    secret: "your-secret-key",
    resave: true,
    saveUninitialized: true,
  })
);

app.set("view engine", "ejs");

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

app.get("/signup", (req, res) => {
  res.sendFile(__dirname + "/signup.html");
});

app.get("/", (req, res) => {
  const usr = req.cookies.userName;

  if (usr) {
    user.findOne({ userName: usr }).then((usr) => {
      if (usr) {
        res.render("home", { name: usr.name, user: usr.userName });
      } else {
        res.redirect("/login");
      }
    });
  } else {
    res.cookie("url", "/");
    res.redirect("/login");
  }
});

app.post("/login", (req, res) => {
  const usr = req.body.usr;
  const pass = req.body.pass;

  res.cookie("userName", usr);
  res.cookie("password", pass);

  const url = req.cookies.url;

  if (url) {
    if (url == "/") res.redirect(url);
    else {
      res.redirect(url);
    }
  } else {
    res.redirect("/");
  }
});

app.post("/signup", (req, res) => {
  console.log("hello");
  var genotp = req.session.sharedData;

  console.log(genotp);

  if (genotp != req.body.otp || genotp === undefined) {
    res.redirect("/signup");
  }

  req.session.sharedData = undefined;

  const newUser = new user({
    userName: req.body.usr,
    name: req.body.name,
    password: req.body.pass,
    mail: req.body.mail,
  });

  newUser
    .save()
    .then(() => res.redirect("/login"))
    .catch((err) => res.send("Error in registering the user\n" + err));
});

app.post("/logout", (req, res) => {
  res.clearCookie("userName");
  res.clearCookie("name");

  res.redirect("/login");
});

app.get("/make-quiz", (req, res) => {
  const cusr = req.cookies.userName;
  const cpass = req.cookies.password;

  if (!cusr) {
    res.cookie("url", "/make-quiz");
    res.redirect("/login");
  } else {
    user
      .findOne({ userName: cusr })
      .then((usr) => {
        if (usr.password == cpass) {
          res.render("makequiz", { name: usr.name, user: usr.userName });
        } else {
          res.cookie("url", "/make-quiz/" + usr);
          res.redirect("/login");
        }
      })
      .catch((err) => {
        res.send("Error in connecting Database\n\n" + err);
      });
  }
});

app.get("/take-quiz", (req, res) => {
  const usr = req.cookies.userName;

  if (usr) {
    user
      .findOne({ userName: usr })
      .then((usr) => {
        res.render("takequiz", { name: usr.name, user: usr.userName });
      })
      .catch((err) => res.send("Error in connectiong database"));
  } else {
    res.cookie("url", "/take-quiz");
    res.redirect("/login");
  }
});

app.get("/take-quiz/:quizID", (req, res) => {
  const qzID = req.params.quizID;
  const cusr = req.cookies.userName;

  if (cusr) {
    user
      .findOne({ userName: cusr })
      .then((usr) => {
        quizIDs
          .findOne({ quizID: qzID })
          .then((quiz) => {
            const userExists = quiz.takenUsers.some(
              (user) => user.userName === cusr
            );
            if (userExists) {
              res.send("You already taken the Quiz");
            } else {
              res.render("QuizTest", {
                name: usr.name,
                user: usr.userName,
                quiz: quiz,
              });
            }
          })
          .catch((err) => res.send("QuizNot Found"));
      })
      .catch((err) => {
        console.log(err);
        res.send("Error in connecting database");
      });
  } else {
    res.cookie("url", "/take-quiz/" + qzID);
    res.redirect("/login");
  }
});

app.post("/validate-quiz/:quizID", (req, res) => {
  var usrRes = req.body;
  var usr = req.cookies.userName;
  const quizID = req.params.quizID;
  var cuser;

  const now = new Date();

  const day = {
    timeZone: "Asia/Kolkata", // IST time zone
    hour12: false, // 24-hour format
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };

  const time = {
    timeZone: "Asia/Kolkata", // IST time zone
    hour12: true, // 24-hour format
    hour: "2-digit",
    minute: "2-digit",
  };

  var ques_num;

  const date = now.toLocaleString("en-US", day);
  const ttime = now.toLocaleString("en-US", time);

  quizIDs.findOne({ quizID: quizID }).then((quiz) => {
    ques_num = quiz.questions.length;
  });

  user.findOne({ userName: usr }).then((usr) => {
    cuser = usr;
  });

  var score = 0;
  var QName;
  quizIDs
    .findOne({ quizID: req.params.quizID })
    .then((resp) => {
      QName = resp.quizName;
      for (const ques of resp.questions) {
        if (usrRes[String(ques.qid)] == String(ques.ans)) score++;
      }

      console.log(ques_num);

      quizIDs
        .findOneAndUpdate(
          { quizID: req.params.quizID },
          {
            $push: {
              takenUsers: {
                userName: usr,
                score: score,
                name: cuser.name,
                submitTime: ttime + " (" + date + ")",
                totalQues: ques_num,
              },
            },
          }
        )
        .then((h) => {});

      user
        .findOneAndUpdate(
          { userName: usr },
          {
            $push: {
              quizTaken: {
                quizID: req.params.quizID,
                quizScore: score,
                quizName: QName,
                submitTime: ttime + " (" + date + ")",
                totalQues: ques_num,
              },
            },
          }
        )
        .then(() => console.log("Succuss"))
        .catch((err) => res.send(err));

      res.render("postScore", {
        name: cuser.name,
        user: cuser.userName,
        score: score,
      });
    })
    .catch((err) => {
      res.send(
        "Sorry but there is a problem with our dataBase Try again Later" + err
      );
    });
});

app.get("/post-test", (req, res) => {
  res.render("postScore", { name: "Ajay", user: "ajay" });
});

app.get("/taken-history", (req, res) => {
  const usr = req.cookies.userName;
  console.log(usr);

  if (usr) {
    var name;
    user.findOne({ userName: usr }).then((usr) => {
      name = usr.name;
      list = usr.quizTaken;
      res.render("takenHistory", { name: name, user: usr, list: list });
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/made-history", (req, res) => {
  const usr = req.cookies.userName;

  user.findOne({ userName: usr }).then((usr) => {
    var usrname = usr.name;
    const list = usr.quizMade;
    let sendList = [];
    console.log(list);
    console.log(list.length);

    // Use Promise.all to wait for all asynchronous calls to complete
    const promises = list.map((item) => {
      return quizIDs.findOne({ quizID: item }).then((quiz) => {
        console.log(quiz);
        const id = quiz.quizID;
        const name = quiz.quizName;
        const notaken = quiz.takenUsers.length;
        const time = quiz.created;
        if (!quiz.quizType || quiz.quizType == "static") {
          sendList.push({
            quizName: name,
            quizID: id,
            noTaken: notaken,
            time: time,
          });
        }
      });
    });

    Promise.all(promises)
      .then(() => {
        res.render("madehistory", {
          name: usr.userName,
          user: usr.name,
          list: sendList,
        });
      })
      .catch((error) => {
        console.error(error);
      });
  });
  /* .catch(err => {
 
         res.redirect('/login');
 
     })*/
});

app.get("/test-report/:quizID", (req, res) => {
  const quizId = req.params.quizID;
  var usr;
  const cusr = req.cookies.userName;

  user.findOne({ userName: cusr }).then((ur) => {
    usr = ur.name;
  });

  quizIDs.findOne({ quizID: quizId }).then((quiz) => {
    const list = quiz.takenUsers;
    res.render("testreport", {
      name: usr,
      user: cusr,
      list: list,
      quiz: [quiz.quizID, quiz.quizName],
    });
  });
});

app.post("/send-login-otp", async (req, res) => {
  const body = req.body;
  const mail = body.mail;
  console.log(mail);
  const min = 1000;
  const max = 9999;
  req.session.sharedData = Math.floor(Math.random() * (max - min + 1)) + min;
  var text = "Your otp to signip Quiz is\n OTP: " + req.session.sharedData;
  var subject = "Quiz Signup OTP";
  const resp = await sendMail(mail, subject, text);
  console.log(resp);
  if (resp) {
    res.json({ stat: true });
  } else {
    res.json({ stat: false });
  }
});

app.post("/validate-login-otp", (req, res) => {
  var post = req.session.sharedData;
  var otp = req.body.otp;
  console.log(otp);
  if (otp == post && otp != undefined) {
    res.json({ stat: true });
  } else {
    res.json({ stat: false });
  }
});

//live Quiz

app.use(
  session({
    joinRoomID: undefined,
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/join-live-quiz", async (req, res) => {
  const uid = req.cookies.userName;

  if (uid) {
    const usr = await user.findOne({ userName: uid });
    if (usr) {
      res.render("joinlive", { name: usr.name, name: usr.userName });
    } else {
      res.redirect("/login");
    }
  } else {
    res.redirect("/login");
  }
});

app.post("/check-live-quiz", async (req, res) => {
  const rid = req.body.rid;
  console.log(roomIds);
  console.log(rid);
  let index = roomIds.indexOf(rid);
  console.log(index);
  if (index == -1) {
    res.json({ stat: false, msg: "Room not found" });
  } else {
    req.session.joinRoomID = rid;
    res.json({ stat: true });
  }
});

app.get("/take-live-quiz", (req, res) => {
  const usr = req.cookies.userName;
  if (!usr) {
    res.redirect("/login");
  }
  const rid = req.session.joinRoomID;
  if (rid) {
    res.render("takelivequiz", {
      name: "Ajay",
      user: "ajay",
      room: rid,
      member: usr,
    });
  } else {
    res.redirect("/join-live-quiz");
  }
});

app.get("/create-room", (req, res) => {
  res.render("createroom", { name: "Ajay", user: "ajay" });
});

app.get("/live-quiz-made", (req, res) => {
  const usr = req.cookies.userName;

  user.findOne({ userName: usr }).then((usr) => {
    var usrname = usr.name;
    const list = usr.quizMade;
    let sendList = [];
    console.log(list);
    console.log(list.length);

    // Use Promise.all to wait for all asynchronous calls to complete
    const promises = list.map((item) => {
      return quizIDs.findOne({ quizID: item }).then((quiz) => {
        console.log(quiz);
        const id = quiz.quizID;
        const name = quiz.quizName;
        const notaken = quiz.takenUsers.length;
        const time = quiz.created;
        if (quiz.quizType && quiz.quizType == "live") {
          sendList.push({
            quizName: name,
            quizID: id,
            noTaken: notaken,
            time: time,
          });
        }
      });
    });

    Promise.all(promises)
      .then(() => {
        res.render("livequizmadehist", {
          name: usr.name,
          user: usr.userName,
          list: sendList,
        });
      })
      .catch((error) => {
        console.error(error);
      });
  });
});

app.get("/live-quiz-waiting-room/:rid", async (req, res) => {
  const users = req.cookies.userName;
  if (!users) {
    res.redirect("/login");
  }
  const usr = await user.findOne({ userName: users });
  if (!usr) {
    res.redirect("/login");
  }
  const roomid = req.params.rid;
  try {
    const quiz = await quizIDs.findOne({ quizID: roomid, quizType: "live" });
    if (quiz) {
      res.render("waitstartquiz", {
        name: usr.name,
        user: usr.userName,
        roomid: roomid,
      });
    } else {
      res.send("Live quiz with id : " + roomid + "not found!");
    }
  } catch (err) {
    res.send("Error Occured in backend");
  }
});

//Web Sockets

var roomIds = [];
var started = [];
var UniqueMap = require("./uniqueMap");
const { Socket } = require("dgram");
var IDMap = new UniqueMap();
var roomSockAss = new Map();
var quizMap = new Map();
var curQues = new Map();

io.on("connection", (socket) => {
  socket.on("createRoom", (roomid) => {
    if (quizMap.has(roomid)) {
      quizMap.set(roomid, quizMap.get(roomid));
    } else {
      quizMap.set(roomid, new Map());
    }
    roomIds.push(roomid);
    console.log("from socket: ", roomIds);
    socket.emit("roomCreateMsg", "Room created with id: " + roomid);
    socket.join(roomid);
    console.log(io.sockets.adapter.rooms);
  });

  async function printList(list, i, qzid) {
    if (i < list.length) {
      const question = {
        qid: list[i].qid,
        questionName: list[i].questionName,
        optiona: list[i].optiona,
        optionb: list[i].optionb,
        optionc: list[i].optionc,
        optiond: list[i].optiond,
      };
      curQues.set(qzid, list[i]);
      console.log(question);
      io.to(qzid).emit("question", question);
      let timerId;
      for (let j = 9; j >= 0; j--) {
        timerId = setTimeout(async () => {
          console.log(j);
          io.to(qzid).emit("quesCd", j);
          if (j === 0) {
            io.to(qzid).emit("reqAns");
            clearTimeout(timerId);
            //if (i + 1 < list.length) {
            await evalWait(list, i + 1, qzid);
            /*}else {
              console.log("End of list");
              await evalWait(list, i + 1, qzid);
              started.splice(started.indexOf(qzid), 1);
              console.log(quizMap);
              //quizMap.get(qzid).clear();
            }*/
          }
        }, (10 - j) * 1000);
      }
    } else {
      console.log("End of list");
      started.splice(started.indexOf(qzid), 1);
    }
  }

  async function evalWait(list, i, qzid) {
    io.to(qzid).emit("evalWait");
    let witId;
    for (let j = 4; j >= 0; j--) {
      witId = setTimeout(async () => {
        console.log(j);
        if (j == 0) {
          if (list[i] && i < list.length) {
            timer(list, i, qzid);
          } else {
            io.to(qzid).emit("finalRes", Object.fromEntries(quizMap.get(qzid)));
            console.log(quizMap.get(qzid));
            console.log("final emited");
            started.splice(started.indexOf(qzid), 1);
            quizMap.get(qzid).clear();
            console.log("Last done");
            quizMap.delete(qzid);
          }
        }
      }, (5 - j) * 1000);
    }
  }

  async function timer(list, i, qzid) {
    console.log("scores displaying");
    console.log(quizMap.get(qzid));
    const ma = Object.fromEntries(quizMap.get(qzid));
    io.to(qzid).emit("dispScore", ma);
    let timerId;
    for (let j = 4; j >= 0; j--) {
      timerId = setTimeout(async () => {
        console.log(j);
        await io.to(qzid).emit("qsctcd", j);
        if (j === 0) {
          clearTimeout(timerId);
          printList(list, i, qzid);
        }
      }, (5 - j) * 1000);
    }
  }

  socket.on("start", async (qzid) => {
    console.log("lis");
    console.log(started);
    console.log(" index");
    console.log(started.indexOf(qzid));
    if (started.indexOf(qzid) == -1) {
      const quiz = await quizIDs.findOne({ quizID: qzid });
      console.log(quiz + " \n start");
      started.push(qzid);

      console.log(started);
      const list = quiz.questions;
      io.to(qzid).emit("st");
      await timer(list, 0, qzid);
    }
  });

  socket.on("cancle", async (qzid) => {});

  socket.on("joinroom", async (data) => {
    roomid = data.room;
    memberid = data.member;
    console.log(memberid);
    console.log(roomid);
    console.log(" sid" + socket.id);
    console.log(io.sockets.adapter.rooms);
    console.log(IDMap.getAllKeys);
    if (IDMap.get(memberid)) {
      socket.emit("joinresp", "Already a member in the room");
    } else if (
      (io.sockets.adapter.rooms.has(roomid) && started.indexOf(roomid) == -1) ||
      quizMap.get(roomid).has(memberid)
    ) {
      try {
        socket.memberid = memberid;
        socket.join(roomid);
        if (!quizMap.get(roomid).has(memberid)) {
          quizMap.get(roomid).set(memberid, { points: 0, time: 0.0 });
        }
        IDMap.put(memberid, socket.id);
        roomSockAss.set(socket.id, roomid);
        const usr = await user.findOne({ userName: memberid });
        io.to(roomid).emit("joinlistmem", { id: memberid, name: usr.name });
        console.log(IDMap);
      } catch (error) {
        socket.emit("joinresp", "Failed to join room: " + roomid);
        console.log(error);
      }
    } else if (started.indexOf(roomid) != -1) {
      socket.emit("joinresp", "Quiz started");
    } else {
      socket.emit("joinresp", "room not found");
    }
  });

  socket.on("disconnect", () => {
    console.log("left sid " + socket.id);
    io.to(roomSockAss.get(socket.id)).emit(
      "removeFromWaitList",
      IDMap.getByValue(socket.id)
    );
    roomSockAss.delete(socket.id);
    IDMap.removeByValue(socket.id);
  });

  socket.on("sendMsg", (msg, rid) => {
    io.to(rid).emit("recMsg", msg);
  });

  socket.on("valques", (qzid, memid, rslt) => {
    console.log(rslt);
    console.log("hi");
    var qs = curQues.get(qzid);
    console.log(rslt);
    console.log(qs);
    console.log("chk-err: ");
    console.log(quizMap.get(qzid));
    var sc = qs.ans == rslt.opt ? 1 : 0;
    if (sc != 0) {
      quizMap.get(qzid).get(memid).points += sc;
      quizMap.get(qzid).get(memid).time += Number(rslt.time);
    } else {
      quizMap.get(qzid).get(memid).time += 10;
    }
  });
});

//API'S

app.post("/valogin", (req, res) => {
  const usrinfo = req.body;
  const username = usrinfo.usr;
  const pass = usrinfo.pass;

  user
    .findOne({ userName: username })
    .then((usr) => {
      if (usr.password == pass) {
        const resp = {
          stat: true,
        };
        console.log("true");
        res.json(resp);
      } else {
        const resp = {
          stat: false,
          msg: "In-valid password",
        };
        res.json(resp);
      }
    })
    .catch((err) => {
      const resp = {
        stat: false,
        msg: "In-valid User",
      };
      res.json(resp);
    });
});

app.post("/chk-user/:userName", (req, res) => {
  const usr = req.params.userName;

  user
    .findOne({ userName: usr })
    .then((foundUser) => {
      if (foundUser) {
        res.json({ stat: false });
      } else {
        res.json({ stat: true });
      }
    })
    .catch((err) => res.json({ stat: true }));
});

app.post("/post-ques/:user", (req, res) => {
  const now = new Date();

  const day = {
    timeZone: "Asia/Kolkata", // IST time zone
    hour12: false, // 24-hour format
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };

  const time = {
    timeZone: "Asia/Kolkata", // IST time zone
    hour12: true, // 24-hour format
    hour: "2-digit",
    minute: "2-digit",
  };

  const date = now.toLocaleString("en-US", day);
  const ttime = now.toLocaleString("en-US", time);

  console.log(req.params.user);
  const quizQ = req.body;
  console.log(quizQ);
  quizQ.quizUser = req.params.user;
  quizQ.takenUsers = [];
  quizQ.created = {
    time: ttime,
    date: date,
  };
  quizIDs
    .create(quizQ)
    .then((saved) => {
      user
        .findOneAndUpdate(
          { userName: req.params.user },
          { $push: { quizMade: quizQ.quizID } }
        )
        .catch((err) => res.json({ stat: false }));
      console.log("in then good");
      res.json({ stat: true });
    })
    .catch((err) => {
      console.log("in catch false");
      res.json({ stat: false });
    });
});

app.post("/chk-quiz", (req, res) => {
  console.log();
  const qz = req.body;
  console.log(qz);
  const quiz = qz.qzId;
  const qusr = qz.usr;
  quizIDs
    .findOne({ quizID: quiz })
    .then((qz) => {
      if (qz) {
        const hasUser = qz.takenUsers.some((usr) => usr.userName == qusr);
        if (!hasUser) {
          res.json({ stat: true });
        } else {
          console.log(hasUser);
          res.json({
            stat: false,
            msg: "Your Already taken the test Contact the Test Admin for Re-Attempt",
          });
        }
      } else {
        res.json({ stat: false, msg: "Quiz Not Found" });
      }
    })
    .catch((err) => {
      res.json({ stat: false, msg: "Error in connecting database" });
    });
});

app.post("/chk-submit", (req, res) => {
  const body = req.body;
  const usr = req.cookies.userName;
  const quz = body.qzID;

  console.log(usr);

  user
    .findOne({ userName: usr })
    .then((usr) => {
      if (usr) {
        const quiz = usr.quizTaken.find((quiz) => quiz.quizID === quz);
        if (quiz) {
          res.json({ stat: false, msg: "You already submitted this Quiz" });
        } else {
          res.json({ stat: true });
        }
      } else {
        res.json({ stat: false, msg: "User not found" });
      }
    })
    .catch((err) => {
      res.json({ stat: false, msg: "Error in connecting database: " + err });
    });
});

app.post("/check-live-quiz-exist", async (req, res) => {
  const qzid = req.body.qzid;
  const quiz = await quizIDs
    .findOne({ quizID: qzid, quizType: "live" })
    .catch((err) => {
      console.log(err);
      res.json({ stat: false, msg: "Unable to fetch data" });
    });
  if (quiz) {
    res.json({ stat: true });
  } else {
    res.json({ stat: false, msg: "Live Quiz not Found" });
  }
});
