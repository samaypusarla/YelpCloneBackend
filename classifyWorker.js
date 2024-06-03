const mobilenet = require("@tensorflow-models/mobilenet");
const {
  getDownloadStreamById,
  updateImageTagsById,
  getPhotoById,
  getImageDownloadStreamByFilename,
  saveNewThumbnail,
  updateThumdId,
} = require("./models/photo");
var fs = require("fs");
const { connectToRabbitMQ, getChannel } = require("./lib/rabbitmq");
const { connectToDb } = require("./lib/mongo");
const Jimp = require("jimp");

async function run() {
  await connectToRabbitMQ("photos");
  const channel = getChannel();
  channel.consume("photos", async (msg) => {
    if (msg) {
      const id = msg.content.toString();
      const downloadStream = getDownloadStreamById(id);

      const imageData = [];
      downloadStream.on("data", function (data) {
        imageData.push(data);
      });
      downloadStream.on("end", async function () {
        const imgBuffer = Buffer.concat(imageData);
        const tags = ["cat"];
        const result = await updateImageTagsById(id, tags);
        const photo = await getPhotoById(id);
        console.log(photo);

        const fullimage = await Jimp.read(imgBuffer);
        await fullimage.resize(100, 100);
        // const saved = fullimage.write(`thumbs/${photo.filename}`);
        await fullimage.writeAsync(`thumbs/${photo.filename}`);
        // console.log("🚀 ~ file: classifyWorker.js:37 ~ saved:", saved);
        fs.readdirSync("thumbs/").forEach((file) => {
          console.log(file);
        });
        const thumbId = await saveNewThumbnail(photo.filename, photo._id);
        await updateThumdId(id, thumbId);

        // photo.UpdateOne

        // console.log("🚀 ~ file: classifyWorker.js:37 ~ thumbId:", thumbId);

        // console.log(thumbId);
      });
    }
    channel.ack(msg);
  });
}

connectToDb(function () {
  run();
});
