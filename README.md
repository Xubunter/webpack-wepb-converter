# webpack-wepb-converter

## Description
Converting background images in css to webp with fallback for not support browsers

## Usage



```js
//webpack.config.js
const webpackWepbConverter= require("webpack-wepb-converter");

module.exports = {
  configureWebpack: {
    plugins: [
      new webpackWepbConverter({
        config: [{
            test: /\.(png)/,
            options: {
              quality: 100,
              lossless: true,
            }
          },
          {
            test: /\.(jpe?g)/,
            options: {
              quality: 90,
              nearLossless: 40,
              sns: 100,
            }
          },
        ]
      })
    ]
  }
}
```

### Custom options in css
`bg-options` is additional css properties for individual converting image. It overwrite default options from webpack config.

```css
.main-img {
  background: url('../img/image1.png');
  bg-options: q(90) m(6) sns(100);
}
.banner-img {
  background: url('../img/image1.png');
  bg-options: lossless m(6);
}
```

### Available options:
Name         | Value |
:----------- |:----------:|
preset       | default, photo, picture, drawing, icon, text   | 
quality      | int        | 
alphaQuality | int        | 
m            | int        | 
size         | int        | 
sns          | int        | 
filter       | int        | 
f            | int        | 
autoFilter   | boolean    | 
sharpness    | int, 0 to 7| 
lossles      | boolean    | 
nearLossless | int        | 
ignore       | boolean    | 

most of int between 0 and 100 

`ignore` skip convert this image

read more https://developers.google.com/speed/webp/docs/cwebp


## Bugs
* media queries not processing yet
* options of same images whith different bg-options in different css selectors may not applay
