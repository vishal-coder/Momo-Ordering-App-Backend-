import { client } from "../index.js";
import { getHashedPassword } from "../util/hashing.js";
import jwt from "jsonwebtoken";
import {
  sendPasswordResetMail,
  sendAccountVerificationMail,
} from "../util/mailer.js";
import Crypto from "crypto";
import bcrypt from "bcrypt";
import {
  registerUser,
  getDBUserByEmail,
  insertToken,
  getToken,
  updatePassword,
  deleteToken,
  verifyEmailToken,
  activatateUser,
  insertAccountConfirmationCode,
  isUserActive,
} from "../models/AuthModel.js";
/**
 * POST /signup
 *
 */
export const signup = async (req, res) => {
  console.log("signup requested", req.body);
  const { firstname, lastname, phone, address, username, password } = req.body;
  const dBUserByEmail = await getDBUserByEmail({ username: username });
  if (dBUserByEmail) {
    return res.status(401).send({ message: "User Already Exists" });
  }

  let hashedPassword = await getHashedPassword(password);
  const registerResult = await registerUser({
    firstname: firstname,
    lastname: lastname,
    username: username,
    password: hashedPassword,
    phone: phone,
    address: address,
    role: "customer",
  });

  var confirmationToken = await jwt.sign(
    { id: registerResult.insertedId.toString() },
    process.env.SECRET_KEY
  );

  const isInserted = await insertAccountConfirmationCode(
    { username: username },
    confirmationToken
  );
  console.log("isInserted", isInserted);
  sendAccountVerificationMail(username, confirmationToken, firstname);

  res.status(200).send({
    message: "User was registered successfully! Please Verify Your Email!",
    success: true,
  });
};

export const login = async (req, res) => {
  const { username, password } = req.body;

  const dBUserByEmail = await getDBUserByEmail({ username: username });

  if (!dBUserByEmail) {
    return res.send({ message: "Invalid Credentials", success: false });
  }

  const isActive = dBUserByEmail.isActive;
  console.log("isActive", dBUserByEmail.isActive);
  if (!isActive) {
    return res.status(401).send({
      message: "Before login, Please verify your email",
      success: false,
    });
  }

  const isPasswordMathced = await bcrypt.compare(
    password,
    dBUserByEmail.password
  );

  if (!isPasswordMathced) {
    console.log("Invalid Credentials");
    return res.send({ message: "Invalid Credentials", success: false });
  }

  var token = jwt.sign(
    { id: dBUserByEmail._id.toString() },
    process.env.SECRET_KEY
  );
  res.header("x-auth-token", token);
  res.send({
    message: "user logged successfully",
    success: true,
    token: token,
    user: {
      name: dBUserByEmail.firstname,
      email: dBUserByEmail.username,
      userType: dBUserByEmail.role,
      address: dBUserByEmail.address,
      token: token,
    },
  });
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const dBUserByEmail = await getDBUserByEmail({ username: email });

  if (!dBUserByEmail) {
    return res.status(401).send({
      message: "User with given email doesn't exists.",
      success: false,
    });
  }

  let resetToken = Crypto.randomBytes(16).toString("hex");
  let hashedResetToken = await getHashedPassword(resetToken);

  let tokenUpdate = await insertToken({ username: email }, hashedResetToken);
  if (!tokenUpdate) {
    return res.status(401).send({
      message: "Something went wront..Please try again later.",
      success: false,
    });
  }

  const mailsuccess = await sendPasswordResetMail(
    email,
    hashedResetToken,
    dBUserByEmail._id
  );

  if (!mailsuccess) {
    return res.status(401).send({
      message: "Something went wront..Please try again later.",
      success: false,
    });
  }

  res.status(200).send({
    message: "verification mail sent to your email address",
    success: true,
  });
};

export const resetpassword = async (req, res) => {
  const { password } = req.body;
  const { token } = req.query;

  const hashedPassword = await getHashedPassword(password);
  const query = { token: token };
  const updateQuery = { $set: { password: hashedPassword } };
  const updatePasswordResult = await updatePassword(query, updateQuery);

  const deleteTokenResult = await deleteToken(token);

  if (!deleteTokenResult) {
    return res.send({
      message: "Invalid token..Please try resetting your password again!",
      success: false,
    });
  }

  res.send({
    message: "Password reset successfully",
    success: true,
  });
};

export const verifyEmail = async (req, res) => {
  const { token } = req.body;
  const isValidToken = await verifyEmailToken({ confirmationToken: token });

  if (!isValidToken) {
    return res.status(404).send({ message: "Invalid token.", success: false });
  }

  const activateUser = await activatateUser(token);

  res.send({
    message: "email verified successfully !!!",
    success: true,
  });
};

export const logoutUser = async (req, res) => {
  console.log("Inside handleLogoutUser");
  const { token } = req.body;
  // TODO: list token as expired or blacklisted

  return res.send({ success: true, message: "user logged out successfully" });
};
