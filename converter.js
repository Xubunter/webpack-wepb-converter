const imagemin = require("imagemin");
const webp = require("imagemin-webp");

const GREEN = "\x1b[32m%s\x1b[0m";
const RED = "\x1b[31m%s\x1b[0m";

const converter = (
  name,
  assets,
  options = {
    quality: 100,
    nearLossless: 60,
  },
  newName,
) => {


  let fileName = newName ? newName : name;
  let outputName = fileName
    .split(".")
    .slice(0, -1)
    .join(".");
  outputName = `${outputName}.webp`;

  let currentAsset = assets[name];

  console.log(`name: ${name}, options: ${options}, newName: ${newName}, savedKB: {savedKB}`)

  return imagemin
    .buffer(currentAsset.source(), {
      plugins: [webp(options)],
    })
    .then((buffer) => {
      
      let savedKB = (currentAsset.size() - buffer.length) / 1000;
    
      if (savedKB <= 0) {
        console.log('')
        console.log(RED, `${savedKB.toFixed(1)} KB over from '${name}'`);
        return savedKB
      }

      const newNameStr = newName ? `, newName: ${newName}` : '';
      console.log('')
      console.log(GREEN, `${savedKB.toFixed(1)} KB saved from '${name}' ${newNameStr}`);
      assets[outputName] = {
        source: () => buffer,
        size: () => buffer.length,
      };


      return savedKB;
    })
    .catch((err) => {
      console.log(err)
      console.log('catch')
      console.log('')
      return 0;
    })
};

module.exports = converter;
