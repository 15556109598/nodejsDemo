//导入express
const express = require('express')
//导入数据库连接池
const pool = require('./config/db')

// 导入body-parser模块，用于解析请求体中的数据
// const bodyParser = require('body-parser')
// // 配置body-parser中间件，解析application/json格式的请求体
// app.use(bodyParser.json())


//导入path模块，用于拼接绝对路径
const path = require('path')
//创建web服务器
const app=express()
// 通过ap.listen进行服务器的配置，并启动服务器，接收两个配置参数，一个是对应的端口号，一个是启动成功的回调函数
//将文件部署到服务器：使用绝对路径，避免因启动目录不同导致 404
app.use(express.static(path.join(__dirname, 'image')));

//get接口的开发
app.get('/api/list',(err,res)=>{
    res.send({
        code:200,
        data:[{name:1},{name:2},{name:3}]
    })
})

//post接口的开发
app.post('/api/setList',(req,res)=>{
    const newList = req.body
    console.log(newList);
    res.send({newList})
})

app.listen(9588,()=>{
    console.log('服务器启动成功');
})