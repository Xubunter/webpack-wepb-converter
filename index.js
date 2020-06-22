const css = require("css");
const addIterations = require("css-ast-iterations");
const converter = require("./converter.js");

const GREEN = "\x1b[32m%s\x1b[0m";
const RED = "\x1b[31m%s\x1b[0m";

const parserCssOptions = (value = "") => {
  const map = {
    'q': 'quality',
    'lossless': 'lossless',
    'near_lossless': 'nearLossless',
    'm': 'method',
    'alpha_q': 'alphaQuality',
    'f': 'filter',
    'af': 'autoFilter',
  }

  const args = value.split(' ');
  let result = {};
  args.map(item => {
    const match = item.match(/(.+)\((.+)\)/);
    let prop;
    let value;
    if (match != null) {
      prop = match[1];
      value = match[2];
    } else {
      prop = item;
      value = true;
    }

    result[map[prop] || prop] = value;

  })

  return result;
}

class PluginWebP {
  constructor({
    config = [
      {
        test: /\.(jpe?g|png)/,
        options: {
          quality: 75,
        },
      },
    ],
  } = {}) {
    this.config = config;
    this.saved = 0;
    this.revert = 0;
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync("cssImageToWebp", (stats, cb) => {
      const cssFiles = Object.keys(stats.assets).filter(
        (file) => file.split(".").pop() === "css"
      );
      const indexFile = stats.assets["index.html"];

      let fallbackCss = css.parse("");
      addIterations(fallbackCss);

      Promise.all(
        cssFiles.map((cssName) => {
          const source = stats.assets[cssName].source();

          const stylesheet = css.parse(source);
          addIterations(stylesheet);

          let promises = [];

          stylesheet.findAllRules((rule, ruleIndex) => {
            if (rule.type === "rule" && rule.declarations) {
              let promisesConverter = [];
              let backgroundData = {};
              rule.findDeclarations((declaration, declarationIndex) => {
                if (
                  declaration.property === 'bg-options'
                ) {
                  backgroundData = {
                    ...backgroundData,
                    options: parserCssOptions(declaration.value),
                    rawOptions: declaration.value,
                    optionsIndex: declarationIndex,
                    cssOptions: true,
                  }
                }
                if (
                  declaration.value.includes("url") &&
                  !declaration.value.includes("data:image")
                ) {
                  const url = declaration.value.match(/url\(.+\)/)[0];

                  let fileName = url.match(/url\([\'\"]?(.+)[\'\"]?\)/)[1];
                  fileName = fileName.replace("../", "");
                  if (fileName && stats.assets[fileName]) {
                    let options;

                    let haveFormatInConfig = false;

                    for (let i = 0; i < this.config.length; i++) {
                      if (this.config[i].test.test(fileName)) {
                        options = this.config[i].options;
                        haveFormatInConfig = true;
                        break;
                      }
                    }

                    if (!haveFormatInConfig) {
                      return;
                    }

                    const convertedFileName = fileName.replace(/\(|\)|/g, '').replace(/\s/g, '-')
                    backgroundData.fileName = fileName;
                    backgroundData.convertedFileName = convertedFileName;
                    backgroundData.options = backgroundData.options ? backgroundData.options : options;
                    backgroundData.sourceValue = declaration.value;
                    backgroundData.sourceUrl = url;
                    backgroundData.sourceIndex = declarationIndex;
                    backgroundData.declaration = declaration;


                  }
                }
              });

              if (backgroundData.fileName && !(backgroundData.options && backgroundData.options.ignore)) {
                let convertedFileName;
                if (backgroundData.cssOptions) {
                  const optNamePart = backgroundData.rawOptions.replace(/\(|\)|/g, '').replace(/\s/g, '-');
                  const arr = backgroundData.fileName.split(".")
                  const fileNamePart = arr.slice(0, -1);
                  const formatPart = arr[arr.length - 1];
                  
                  convertedFileName = `${fileNamePart.join('.')}${optNamePart}.${formatPart}`
                }
                
                promises.push(
                  converter(backgroundData.fileName, stats.assets, backgroundData.options, convertedFileName).then((savedKB) => {
                    if (savedKB) {
                      let revert = false;
                      if (savedKB > 0) {
                        this.saved += savedKB;
                      } else {
                        this.revert += savedKB;
                        revert = true;
                        return revert;
                      }
  
                      // const webpLink = url.replace(
                      //   /\.(jpe?g|png)/,
                      //   ".webp"
                      // );
  
                      let tmpFileName = convertedFileName && !revert ? convertedFileName : backgroundData.fileName;
                      tmpFileName = tmpFileName.split(".").slice(0, -1).join(".");
  
                      const webpLink = backgroundData.sourceValue.replace(
                        /url\(.+\)/,
                        `url(../${tmpFileName}.webp)`
                      );
  
                      const newDeclarationWebp = {
                        ...backgroundData.declaration,
                        value: webpLink,
                      };
  
                      const newDeclarationFallback = {
                        ...backgroundData.declaration,
                        value: backgroundData.sourceUrl,
                        property: "background-image",
                      };
  
                      const customRule = {
                        ...rule,
                        declarations: [newDeclarationFallback],
                      };
  
                      rule.removeDeclaration(backgroundData.sourceIndex);
                      rule.addDeclaration(
                        newDeclarationWebp.property,
                        newDeclarationWebp.value,
                        backgroundData.sourceIndex
                      );
  
                      fallbackCss.addRule(customRule);
                    }
                  })
                );
              }
              
            }
          });

          return Promise.all(promises).then(() => {
            const cssResult = css.stringify(stylesheet).replace(/\r?\n/g, "");

            stats.assets[cssName] = {
              source: () => cssResult,
              size: () => cssResult.length,
            };
          });
        })
      ).then(() => {
        const fallbackCssString = css
          .stringify(fallbackCss)
          .replace(/\r?\n/g, "");

        const style = `
<script>
    function addStyle(result){
      if (!result) {
        document.querySelector('head').innerHTML +='<style>${fallbackCssString}</style>'
      }
      let test = document.getElementById('testWebp');
      if (test) {test.innerHTML = result;}
    }
    var kTestImages = {
        lossy: "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
        lossless: "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
        alpha: "UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==",
        animation: "UklGRlIAAABXRUJQVlA4WAoAAAASAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GJgAAAAAAAAAAAAAAAAAAAGQAAABWUDhMDQAAAC8AAAAQBxAREYiI/gcA"
    };
    var img = new Image();
    img.onload = function () {
        var result = (img.width > 0) && (img.height > 0);
        addStyle(result);
    };
    img.onerror = function () {
        addStyle(false);
    };
    img.src = "data:image/webp;base64," + kTestImages['animation'];
</script>
`;

        const findIndex = indexFile.source().indexOf("</head>");
        const begin = indexFile.source().slice(0, findIndex);
        const end = indexFile.source().slice(findIndex);
        const result = `${begin}${style}${end}`;

        stats.assets["index.html"] = {
          source: () => result,
          size: () => result.length,
        };

        cb();
      });
    });
    compiler.hooks.done.tap("cssImageToWebp", () => {
      console.log(GREEN, `  saved: ${this.saved.toFixed(1)} KB`);
      console.log(RED, `  revert: ${this.revert.toFixed(1)} KB`);
    });
  }
}

module.exports = PluginWebP;
