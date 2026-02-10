const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = require("../schemas/userModel");
const courseSchema = require("../schemas/courseModel");
const enrolledCourseSchema = require("../schemas/enrolledCourseModel");
const coursePaymentSchema = require("../schemas/coursePaymentModel");

////////// REGISTER //////////
const registerController = async (req, res) => {
  try {
    const existsUser = await userSchema.findOne({ email: req.body.email });
    if (existsUser) {
      return res
        .status(409)
        .send({ message: "User already exists", success: false });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    const newUser = new userSchema({
      ...req.body,
      password: hashedPassword,
    });

    await newUser.save();

    return res
      .status(201)
      .send({ message: "Register successful", success: true });
  } catch (error) {
    console.log("Register error:", error);
    return res
      .status(500)
      .send({ success: false, message: error.message });
  }
};

////////// LOGIN //////////
const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userSchema.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .send({ message: "User not found", success: false });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .send({ message: "Invalid email or password", success: false });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_KEY, {
      expiresIn: "1d",
    });

    const { password: pwd, ...safeUser } = user._doc;

    return res.status(200).send({
      message: "Login successful",
      success: true,
      token,
      userData: safeUser,
    });
  } catch (error) {
    console.log("Login error:", error);
    return res
      .status(500)
      .send({ success: false, message: error.message });
  }
};

////////// GET ALL COURSES //////////
const getAllCoursesController = async (req, res) => {
  try {
    const allCourses = await courseSchema.find();
    return res.status(200).send({
      success: true,
      data: allCourses,
    });
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).send({ success: false, message: "Failed to fetch courses" });
  }
};

////////// POST COURSE //////////
const postCourseController = async (req, res) => {
  try {
    let price;
    const {
      userId,
      C_educator,
      C_title,
      C_categories,
      C_price,
      C_description,
      S_title,
      S_description,
    } = req.body;

    const S_content = req.files.map((file) => file.filename);

    const sections = [];
    if (Array.isArray(S_title)) {
      for (let i = 0; i < S_content.length; i++) {
        sections.push({
          S_title: S_title[i],
          S_content: {
            filename: S_content[i],
            path: `/uploads/${S_content[i]}`,
          },
          S_description: S_description[i],
        });
      }
    } else {
      sections.push({
        S_title: S_title,
        S_content: {
          filename: S_content[0],
          path: `/uploads/${S_content[0]}`,
        },
        S_description: S_description,
      });
    }

    price = C_price == 0 ? "free" : C_price;

    const course = new courseSchema({
      userId,
      C_educator,
      C_title,
      C_categories,
      C_price: price,
      C_description,
      sections,
    });

    await course.save();

    res
      .status(201)
      .send({ success: true, message: "Course created successfully" });
  } catch (error) {
    console.error("Post course error:", error);
    res.status(500).send({ success: false, message: "Failed to create course" });
  }
};

////////// GET COURSES FOR USER //////////
const getAllCoursesUserController = async (req, res) => {
  try {
    const allCourses = await courseSchema.find({ userId: req.body.userId });

    return res.send({
      success: true,
      message: "All Courses Fetched Successfully",
      data: allCourses,
    });
  } catch (error) {
    console.error("User courses error:", error);
    res.status(500).send({ success: false, message: "Failed to fetch courses" });
  }
};

////////// DELETE COURSE //////////
const deleteCourseController = async (req, res) => {
  const { courseid } = req.params;
  try {
    const course = await courseSchema.findByIdAndDelete(courseid);

    if (!course) {
      return res
        .status(404)
        .send({ success: false, message: "Course not found" });
    }

    res
      .status(200)
      .send({ success: true, message: "Course deleted successfully" });
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).send({ success: false, message: "Failed to delete course" });
  }
};

////////// ENROLL COURSE //////////
const enrolledCourseController = async (req, res) => {
  const { courseid } = req.params;
  const noting = req.body;
  try {
    const course = await courseSchema.findById(courseid);

    if (!course) {
      return res
        .status(404)
        .send({ success: false, message: "Course Not Found!" });
    }

    const enrolledCourse = await enrolledCourseSchema.findOne({
      courseId: courseid,
      userId: req.body.userId,
    });

    if (enrolledCourse) {
      return res.status(409).send({
        success: false,
        message: "You are already enrolled in this Course!",
      });
    }

    const enrolledCourseInstance = new enrolledCourseSchema({
      courseId: courseid,
      userId: req.body.userId,
      course_Length: course.sections.length,
    });

    const coursePayment = new coursePaymentSchema({
      userId: req.body.userId,
      courseId: courseid,
      ...noting,
    });

    await coursePayment.save();
    await enrolledCourseInstance.save();

    course.enrolled += 1;
    await course.save();

    res.status(200).send({
      success: true,
      message: "Enroll Successfully",
      course: { id: course._id, Title: course.C_title },
    });
  } catch (error) {
    console.error("Enroll error:", error);
    res.status(500).send({ success: false, message: "Failed to enroll course" });
  }
};

////////// SEND COURSE CONTENT //////////
const sendCourseContentController = async (req, res) => {
  const { courseid } = req.params;

  try {
    const course = await courseSchema.findById(courseid);
    if (!course)
      return res
        .status(404)
        .send({ success: false, message: "No such course found" });

    const user = await enrolledCourseSchema.findOne({
      userId: req.body.userId,
      courseId: courseid,
    });

    if (!user) {
      return res
        .status(403)
        .send({ success: false, message: "User not enrolled in this course" });
    }

    return res.status(200).send({
      success: true,
      courseContent: course.sections,
      completeModule: user.progress,
      certificateData: user,
    });
  } catch (error) {
    console.error("Send content error:", error);
    return res
      .status(500)
      .send({ success: false, message: "Internal server error" });
  }
};

////////// COMPLETE SECTION //////////
const completeSectionController = async (req, res) => {
  const { courseId, sectionId } = req.body;

  try {
    const enrolledCourseContent = await enrolledCourseSchema.findOne({
      courseId,
      userId: req.body.userId,
    });

    if (!enrolledCourseContent) {
      return res
        .status(400)
        .send({ message: "User is not enrolled in the course" });
    }

    const updatedProgress = enrolledCourseContent.progress || [];
    updatedProgress.push({ sectionId });

    await enrolledCourseSchema.findByIdAndUpdate(
      enrolledCourseContent._id,
      { progress: updatedProgress },
      { new: true }
    );

    res.status(200).send({ message: "Section completed successfully" });
  } catch (error) {
    console.error("Complete section error:", error);
    res.status(500).send({ message: "Internal server error" });
  }
};

////////// SEND ALL COURSES FOR USER //////////
const sendAllCoursesUserController = async (req, res) => {
  const { userId } = req.body;
  try {
    const enrolledCourses = await enrolledCourseSchema.find({ userId });

    const coursesDetails = await Promise.all(
      enrolledCourses.map(async (enrolledCourse) => {
        return await courseSchema.findById(enrolledCourse.courseId);
      })
    );

    return res.status(200).send({
      success: true,
      data: coursesDetails,
    });
  } catch (error) {
    console.error("Send all courses error:", error);
    res.status(500).json({ error: "An error occurred" });
  }
};

module.exports = {
  registerController,
  loginController,
  getAllCoursesController,
  postCourseController,
  getAllCoursesUserController,
  deleteCourseController,
  enrolledCourseController,
  sendCourseContentController,
  completeSectionController,
  sendAllCoursesUserController,
};
