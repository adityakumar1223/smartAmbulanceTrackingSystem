const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware.js");
const User = require("../models/user.js");
const Post = require("../models/post.js");
const Hazard = require("../models/hazard.js");

// INITIAL SEED DATA FOR DEMO FEED
const INITIAL_POSTS = [
  {
    author: {
      name: "Paramedic John Miller",
      role: "driver",
      avatar: "🚑"
    },
    content: "Just cleared the main Highway 101 intersection near the bridge! The earlier heavy traffic bottleneck has fully subsided. Responding ambulance units can now take this route freely with zero delays. Stay safe out there, crew!",
    image: null,
    likes: 18,
    likedBy: [],
    comments: [
      { id: "c-1", author: "Dispatcher Emily Rose", content: "Great update, John! Relaying this to Unit 14 immediately.", createdAt: new Date(Date.now() - 3600000) },
      { id: "c-2", author: "Dr. Sarah Adams", content: "Superb. We have an incoming trauma unit headed that way now.", createdAt: new Date() }
    ],
    createdAt: new Date(Date.now() - 3600000 * 2)
  },
  {
    author: {
      name: "Dr. Sarah Adams",
      role: "hospital",
      avatar: "🏥"
    },
    content: "Trauma Ward A and our cardiovascular response teams are fully prepared and on standby for any incoming emergency incidents today. We have prepped 3 additional surgical rooms and assigned specialist supervisors. Let's save some lives!",
    image: "https://images.unsplash.com/photo-1584515906247-4b4c407fcc1d?auto=format&fit=crop&w=600&q=80",
    likes: 32,
    likedBy: [],
    comments: [
      { id: "c-3", author: "Aditya Kumar", content: "Thank you for all your dedication and service, Doctor! 🙏", createdAt: new Date() }
    ],
    createdAt: new Date(Date.now() - 3600000 * 5)
  },
  {
    author: {
      name: "Aditya Kumar",
      role: "patient",
      avatar: "👤"
    },
    content: "Huge shoutout to the paramedic dispatch crew who responded within 4 minutes flat to my cardiac distress alert last night. Their composure and swift navigation on the maps were truly lifesaving. I am resting stable now. Thank you, SmartAmbulance!",
    image: null,
    likes: 45,
    likedBy: [],
    comments: [
      { id: "c-4", author: "Paramedic John Miller", content: "Glad we could reach you in time, Aditya! Keep resting well.", createdAt: new Date() }
    ],
    createdAt: new Date(Date.now() - 3600000 * 12)
  }
];

const INITIAL_HAZARDS = [
  {
    route: "Highway 101 Crossing (Northbound)",
    type: "Potholes",
    severity: "critical",
    description: "Massive, deep potholes in the middle and left lanes right before the bypass bridge. Extremely dangerous for high-speed ambulance transit as it can damage suspension or cause sudden swerving!",
    upvotes: 14,
    upvotedBy: [],
    author: "Paramedic John Miller",
    createdAt: new Date(Date.now() - 3600000 * 3)
  },
  {
    route: "East Valley Boulevard Underpass",
    type: "Water-Logging",
    severity: "critical",
    description: "Water main burst has completely flooded the underpass, rendering it impassable for standard vehicles and risky for emergency rigs. Traffic is fully backed up. Direct dispatch detours are required via West Road!",
    upvotes: 21,
    upvotedBy: [],
    author: "Aditya Kumar",
    createdAt: new Date(Date.now() - 3600000 * 8)
  },
  {
    route: "Broadway Avenue (Intersecting 5th St)",
    type: "Construction",
    severity: "medium",
    description: "Active road resurfacing construction has narrowed traffic lanes to a single lane. Heavy delays during rush hour. Paramedics should use caution and consider using 7th Avenue as an alternative route.",
    upvotes: 6,
    upvotedBy: [],
    author: "Dr. Sarah Adams",
    createdAt: new Date(Date.now() - 3600000 * 20)
  }
];

// Helper to seed community DB if empty
const seedIfEmpty = async () => {
  try {
    const postCount = await Post.countDocuments();
    if (postCount === 0) {
      await Post.insertMany(INITIAL_POSTS);
      console.log("Community posts successfully seeded.");
    }
    const hazardCount = await Hazard.countDocuments();
    if (hazardCount === 0) {
      await Hazard.insertMany(INITIAL_HAZARDS);
      console.log("Road hazards successfully seeded.");
    }
  } catch (err) {
    console.error("Error seeding community collections:", err);
  }
};

// GET ALL SOCIAL POSTS
router.get("/posts", protect, async (req, res) => {
  try {
    await seedIfEmpty();
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ message: "Failed to load posts", error: err.message });
  }
});

// CREATE A SOCIAL POST
router.post("/posts", protect, async (req, res) => {
  try {
    const { content, image } = req.body;
    // Fetch full user from DB since JWT only contains id and role (BUG-06)
    const fullUser = await User.findById(req.user.id).select("name username role");
    const authorName = fullUser?.name || fullUser?.username || "Anonymous User";
    const authorRole = fullUser?.role || req.user.role || "patient";
    const authorAvatar = authorRole === "driver" ? "🚑" : authorRole === "hospital" ? "🏥" : authorRole === "admin" ? "🛡️" : "👤";
    
    const newPost = new Post({
      author: {
        name: authorName,
        role: authorRole,
        avatar: authorAvatar
      },
      content,
      image,
      likes: 0,
      likedBy: [],
      comments: [],
      createdAt: new Date()
    });

    await newPost.save();

    // Broadcast in real-time
    const io = req.app.get("io");
    if (io) {
      io.emit("community_post_created", newPost);
      console.log("Real-time Broadcast: New social post created");
    }

    res.status(201).json(newPost);
  } catch (err) {
    res.status(500).json({ message: "Failed to publish post", error: err.message });
  }
});

// TOGGLE LIKE ON POST
router.post("/posts/:id/like", protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Social post not found" });
    }

    const userId = req.user.id;
    const likedIndex = post.likedBy.indexOf(userId);

    if (likedIndex > -1) {
      post.likedBy.splice(likedIndex, 1);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedBy.push(userId);
      post.likes += 1;
    }

    await post.save();

    // Broadcast updated post state
    const io = req.app.get("io");
    if (io) {
      io.emit("community_post_updated", post);
      console.log(`Real-time Broadcast: Post ${post._id} updated (likes count)`);
    }

    res.json(post);
  } catch (err) {
    res.status(500).json({ message: "Failed to toggle like", error: err.message });
  }
});

// SUBMIT COMMENT ON POST
router.post("/posts/:id/comment", protect, async (req, res) => {
  try {
    const { id: commentId, author, content } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Social post not found" });
    }

    // Fetch full user from DB for comment author name (BUG-06)
    const fullUser = await User.findById(req.user.id).select("name username");
    const authorName = fullUser?.name || fullUser?.username || author || "Anonymous";

    post.comments.push({
      id: commentId || `c-${Date.now()}`,
      author: authorName,
      content,
      createdAt: new Date()
    });

    await post.save();

    // Broadcast updated post state
    const io = req.app.get("io");
    if (io) {
      io.emit("community_post_updated", post);
      console.log(`Real-time Broadcast: Post ${post._id} updated (new comment)`);
    }

    res.json(post);
  } catch (err) {
    res.status(500).json({ message: "Failed to add comment", error: err.message });
  }
});

// GET ROAD HAZARDS
router.get("/hazards", protect, async (req, res) => {
  try {
    await seedIfEmpty();
    const hazards = await Hazard.find().sort({ createdAt: -1 });
    res.json({ hazards });
  } catch (err) {
    res.status(500).json({ message: "Failed to load safety hazards", error: err.message });
  }
});

// CREATE ROAD HAZARD complaint
router.post("/hazards", protect, async (req, res) => {
  try {
    const { route, type, severity, description } = req.body;
    
    // Fetch full user from DB for hazard author name (BUG-06)
    const fullUser = await User.findById(req.user.id).select("name username");
    const authorName = fullUser?.name || fullUser?.username || "Anonymous User";

    const newHazard = new Hazard({
      route,
      type,
      severity,
      description,
      upvotes: 0,
      upvotedBy: [],
      author: authorName,
      createdAt: new Date()
    });

    await newHazard.save();

    // Broadcast in real-time
    const io = req.app.get("io");
    if (io) {
      io.emit("community_hazard_created", newHazard);
      console.log("Real-time Broadcast: New road hazard reported");
    }

    res.status(201).json(newHazard);
  } catch (err) {
    res.status(500).json({ message: "Failed to report safety hazard", error: err.message });
  }
});

// TOGGLE UPVOTE ON HAZARD
router.post("/hazards/:id/upvote", protect, async (req, res) => {
  try {
    const hazard = await Hazard.findById(req.params.id);
    if (!hazard) {
      return res.status(404).json({ message: "Safety hazard alert not found" });
    }

    const userId = req.user.id;
    const upvotedIndex = hazard.upvotedBy.indexOf(userId);

    if (upvotedIndex > -1) {
      hazard.upvotedBy.splice(upvotedIndex, 1);
      hazard.upvotes = Math.max(0, hazard.upvotes - 1);
    } else {
      hazard.upvotedBy.push(userId);
      hazard.upvotes += 1;
    }

    await hazard.save();

    // Broadcast updated hazard state
    const io = req.app.get("io");
    if (io) {
      io.emit("community_hazard_updated", hazard);
      console.log(`Real-time Broadcast: Hazard ${hazard._id} updated (upvote count)`);
    }

    res.json(hazard);
  } catch (err) {
    res.status(500).json({ message: "Failed to upvote hazard", error: err.message });
  }
});

module.exports = router;
