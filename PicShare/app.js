const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
var findOrCreate = require("mongoose-findorcreate");
require("dotenv").config();

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(
  session({
    secret: "This is a secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(
 process.env.DB_CONNECT,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
mongoose.set("useCreateIndex", true);

const imageSchema = mongoose.Schema({
  name: String,
  desc: String,
  img: {
    data: Buffer,
    contentType: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

const Image = new mongoose.model("Image", imageSchema);
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  date: {
    type: Date,
    default: Date.now,
  },
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("user", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
      userProfileURL: process.env.USER_PROFILE_URL,
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/documentation", function (req, res) {
  res.send(
    "Under development!!! <br> Not responsive, not suitable to view on mobile phone "
  );
});
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now());
  },
});

const upload = multer({
  storage: storage,
});
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/home",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/home");
  }
);

app.get("/gallery", (req, res) => {
  Image.find({})
    .sort([["date", -1]])
    .exec((err, items) => {
      if (err) {
        console.log(err);
      } else {
        res.render("gallery", {
          items: items,
        });
      }
    });
});
app.get("/home", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("home");
  } else {
    res.redirect("/login");
  }
});
app.get("/add", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("add");
  } else {
    res.redirect("/login");
  }
});

app.post("/add", upload.single("image"), (req, res, next) => {
  const obj = new Image({
    name: req.body.name,
    desc: req.body.pesc,
    img: {
      data: fs.readFileSync(
        path.join(__dirname + "/uploads/" + req.file.filename)
      ),
      contentType: "image/png",
    },
  });
  obj.save();
  res.redirect("/home");
});

app.get("/images/:id", function (req, res) {
  const id = req.params.id;

  Image.findById(id, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      res.render("image", {
        image: docs.img,
        name: docs.name,
        title: docs.desc,
      });
    }
  });
});
app.get("/login", function (req, res) {
  res.render("login");
});
app.get("/register", function (req, res) {
  res.render("register");
});
app.post("/register", function (req, res) {
  const username = req.body.username;
  const password = req.body.password;

  User.register(
    {
      username,
    },
    password,
    function (err, user) {
      if (!err) {
        passport.authenticate("local")(req, res, function (err, result) {
          if (err) {
            console.log(err);
          } else {
            res.redirect("/home");
          }
        });
      } else {
        res.redirect("/register");
      }
    }
  );
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});
app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function (err, result) {
        res.redirect("/home");
      });
    }
  });
});

app.get("/", function (req, res) {
  res.render("main");
});
app.listen(process.env.PORT || 3000, function () {
  console.log("Server started");
});
