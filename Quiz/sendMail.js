const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'jampanaatchutaramaraju@gmail.com', // replace with your Gmail email address
    pass: 'duwb wuhj klka hdpq' // replace with your Gmail password or app password
  },
});

async function sendMail(to, subject, text){
// Define the email options
const mailOptions = {
  from: 'jampanaatchutaramaraju@gmail.com', // replace with your Gmail email address
  to: to, // replace with the recipient's email address
  subject: subject,
  text: text
};
try{
  await transporter.sendMail(mailOptions).then(res => console.log("mail sent"));
  return true;
}
catch(err){
  console.log("Error in sending mail\n" + err);
  return false;
}
  
}

module.exports = sendMail;