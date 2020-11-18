let clicked = false;
let highestVertical = 0;
let winner = false;
let reloader = getCookie("reloader");
let ingame = false;
let singlePlayerModeBool = false;



$("#scoreboard").hide();
$("#spil").hide();
$("#gamebody").hide();
$("#errorDiv").hide();

/*
@@@@@@@@@@@@@@@@@@@@@@@@               @@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@               @@@@@@@@@@@@@@@@@@@@@@@@
                        ROOM MECHANICS!
@@@@@@@@@@@@@@@@@@@@@@@@               @@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@               @@@@@@@@@@@@@@@@@@@@@@@@
*/

//get all the open rooms for openroomList
socket.on("allRooms", function(data){
    document.getElementById("actualOpenRooms").innerHTML = "";
    for(let i = 0; i < data.length; i++){
        appendRoom(data[i]);
    }
})

socket.on('newRoom', (data) =>{
    appendRoom(data);
})

function appendRoom(data){
    let container = document.createElement("div");
    container.setAttribute("class", "openRoom");

    let header = document.createElement("h4");
    let headerText = document.createTextNode(data.roomid);

    header.appendChild(headerText);

    let button = document.createElement("button");
    let butText = document.createTextNode("Join Room!");

    button.setAttribute("onclick", "joinRoom('"+data.roomid+"')");
    button.setAttribute("class", "joinButton");
    button.setAttribute("id", data.roomid+"joiningroombutton");
    button.appendChild(butText);

    container.appendChild(header);
    container.appendChild(button);

    if(data.password != ""){
        let lockDiv = document.createElement("div");

        let img = document.createElement("img");
        img.setAttribute("src", "padlock.png");
        img.setAttribute("class", "passLock");

        lockDiv.appendChild(img);
        container.appendChild(lockDiv);

        let passIn = document.createElement("input");
        passIn.setAttribute("type", "text");
        passIn.setAttribute("id", "passIn" + data.roomid);
        passIn.setAttribute("placeholder", "Pass key");

        container.appendChild(passIn);
    }

    document.getElementById("actualOpenRooms").appendChild(container);
}


function newRoom(){
    let roomId = document.getElementById("roominput").value;
    //? maybe check gametype onclick to supply different options for each type
    if(document.getElementById("multiplayer").checked == true){
        //multiplayer spil
        //check for password
        let password = "";
        if(document.getElementById("passwordOn").checked == true){
            password = document.getElementById("password").value;
        } else {
            password = "";
        }
        socket.emit("createRoom", {
            roomId: roomId,
            password: password
        });
    } else if(document.getElementById("singlePlayer").checked == true){
        singlePlayerMode();
    } else {
        console.log("errors! sorry..");
    }
}

document.getElementById("roominput").addEventListener("keyup", (e) =>{
    if(e.keyCode == 13){
        newRoom();
    }
})

function hidePassword(){
    $("#password").slideUp();
}

function showPassword(){
    $("#password").slideDown();
}

let errorOut = false;
//all error handling here 
//TODO: make som error codes at some point
socket.on("erorr", (err) => {
    let con = document.getElementById("errorDiv");
    let msg = document.getElementById("errorMessage");
    msg.innerHTML = err;
    if(!errorOut){
        errorOut = true;
        $("#errorDiv").slideDown(700).delay(2000).slideUp(700, function(){
            errorOut = false;
            if(err == "Other player left"){
                quitToMain();
                location.reload();
            }
        });
    }
})


let aRoomHasPass = "";

//used for removing the inputfield and reverting to normal 
document.addEventListener("click", (e) => {
    if(e.path.length < 8){
        if(aRoomHasPass != ""){
            let room = document.getElementById(aRoomHasPass + "room");
            room.setAttribute("class", "openRoom");
            room.removeChild(document.getElementById("passIn" + aRoomHasPass));
            aRoomHasPass = "";
        }
    }
})

function joinRoom(roomid){
    //TODO: needs to be done? :)
    let pass = "";
    try{ 
        pass = document.getElementById("passIn"+roomid).value;
    } catch(e){
        // det er nok fint nok det her
    }
    socket.emit("joinRoom", {
        roomId: roomid,
        password: pass
    });
}

function searchForRoom(){
    //TODO: needs to be done? :)
}

let playerNum;
//TODO: do something better with the roomid
let usethisRooomid;

socket.on("response", data => {
    if(data.status == "tiptop"){
        $("#roomOptions").hide();
        spil();
        createChat();
        $("#scoreboard").show();
        $("#gamebody").show();
    }
    if(data.type == "created"){
        playerNum = 1;
        ingame = true;

        socket.emit("chatMsg", {
            room: data.roomid,
            msg: "Waiting for player 2",
            player: "0"
        })
        
    } else if(data.type == "joined"){
        playerNum = 2;
        ingame = true;

        socket.emit("chatMsg", {
            room: data.roomid,
            msg: "Player 2 joined!",
            player: "0"
        })

        console.log(gameState);
    } else if(data.type == "rejoin"){
        //TODO: Find en bedre måde, eventuelt kig på databasen og se efter hvordan tingene skal placeres
        //Men det fungere da for nu, folk må tage sig lidt sammen jo :)
        gameState = JSON.parse(getCookie("game"));
        playerNum = getCookie("player");
        spil();
        ingame = true;
        //? consider doing this in the other "responses" or just move it out of the "if"
        for(let i = 0; i < data.chat.length; i++){
            handleChats(data.chat[i].message, data.chat[i].player, data.chat[i].time);
        }
        document.getElementById("player1points").innerHTML = gameState.points[0];
        document.getElementById("player2points").innerHTML = gameState.points[1];

    }
    usethisRooomid = data.roomid;
})

function singlePlayerMode(){
    //consider making this work offline, for now it just uses the same stuff as multiplayer to check for wins

    singlePlayerModeBool = true;
    $("#roomOptions").hide();
    spil();
    //createChat(); Maybe dont do that, or use a chat robot/ai :D
    $("#scoreboard").show();
    $("#gamebody").show();
    playerNum = 1;
    ingame = true;
}

function robotMove(game){
    //make this one smarter 
    if(singlePlayerModeBool && game.turn == 2){
        let updater = game;
        let botColumn = Math.floor(Math.random() * 8);
        console.log(updater.columns[botColumn]);
        while(updater.columns[botColumn] >= 5){
            botColumn = Math.floor(Math.random() * 8);
        }
        let piecePlaced = false;
        let height = 0;
        for(let i = updater.board[botColumn].length-1; i > 0; i--){
            if(updater.board[botColumn][i] == 0 && piecePlaced == false){
                piecePlaced = true;
                //console.log(i + " | " + botColumn);
                updater.board[botColumn][i] = 2;
                height = i;
                updater.columns[botColumn] += 1;
            }
        }
        gameState = updater;
        for(let i = 0; i < gameState.board.length; i++){
            
        }
        socket.emit("brickplaced", {
            game: gameState,
            roomid: "singleplayer",
            placeCol: botColumn + 1,
            placeRow: height +1
        });
    }
}

function setup(){
    //TODO: move setup stuff here at some point maybe... probably not
}

//
// QUITTING ROOM
//
function quitToMain(){
    setCookie("reloader", "false");
    delete_cookie("roomID");
    delete_cookie("player");
    delete_cookie("game");
    delete_cookie("reloader");
    board = [[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]];
    columns = [0,0,0,0,0,0,0,0];
    gameState = {
        turn: 1,
        board: board,
        columns: columns,
        isDone: false,
        whoWon: "",
        points: [0,0],
        player1ready: false,
        player2ready: false,
    }

    document.getElementById("brickField").innerHTML = "";
    $("#spil").hide();
    $("#roomOptions").show();
    $("#scoreboard").hide();
    $("#gamebody").hide();
    if(!singlePlayerModeBool){
        socket.emit("leave",{
            room: usethisRooomid,
            player: playerNum
        })
    }
    ingame = false;
    if(!singlePlayerModeBool){
        let chat = document.getElementById("chatCon");
        document.getElementById("gamebody").removeChild(chat);
    }
    singlePlayerModeBool = false;
    location.reload();
}


/*
@@@@@@@@@@@@@@@@@@@@@@@@               @@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@               @@@@@@@@@@@@@@@@@@@@@@@@
                        GAME MECHANICS!
@@@@@@@@@@@@@@@@@@@@@@@@               @@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@               @@@@@@@@@@@@@@@@@@@@@@@@
*/
let board = [[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]];
let columns = [0,0,0,0,0,0,0,0];

let gameState = {
    turn: 1,
    board: board,
    columns: columns,
    isDone: false,
    whoWon: "",
    points: [0,0],
    player1ready: false,
    player2ready: false,
}
//console.log(gameState);

socket.on("joined", (data) => {
    if(data == "gamewasjoined"){
        gameState.player1ready = true;
        gameState.player2ready = true;
    }
})

function spil(){
    document.getElementById('brickField').innerHTML = "";
    let table = document.createElement('table');
    for(let rowcount = 0; rowcount < 7; rowcount++){
        let row = document.createElement('tr');
        for(let cellcount = 0; cellcount < 8; cellcount++){
            let cell = document.createElement('td');
            if(rowcount == 0){
                cell.setAttribute('class', 'overboard');
                cell.setAttribute('onmouseover', "placering("+cellcount+")");
                cell.setAttribute('onmouseout', "reset("+cellcount+")");
                cell.setAttribute('onclick', "place("+cellcount+")");
                let cellheader = document.createElement("h4");
                cellheader.setAttribute("class", "rowcounter" );
                let celltext = document.createTextNode(cellcount + 1);
                cellheader.appendChild(celltext);
                cell.appendChild(cellheader);
            } else if (gameState.board[cellcount][rowcount-1] == 1){
                cell.setAttribute('class', 'onboards player1s');
                //cell.setAttribute('class', 'player1s');
                row.setAttribute('class', 'board');
            } else if (gameState.board[cellcount][rowcount-1] == 2){
                cell.setAttribute('class', 'onboards player2s');
                //cell.setAttribute('class', 'player2s');
                row.setAttribute('class', 'board');
            } else {
                cell.setAttribute('class', 'onboards');
                row.setAttribute('class', 'board');
            }
            cell.setAttribute('id', rowcount + "," + cellcount);
            row.appendChild(cell);
        }
        table.appendChild(row);
    }
    document.getElementById('brickField').appendChild(table);
}

function placering(column){
    if(gameState.turn == playerNum && gameState.isDone != true){
        for(let i = 6 - gameState.columns[column]; i > 0; i--){
            if (playerNum == 1){
                document.getElementById(""+i+","+column+"").style.backgroundColor = "green";
            } else if(playerNum == 2){
                document.getElementById(""+i+","+column+"").style.backgroundColor = "blue";
            } else {
                //nothing
            }
        }
        clicked = false;
    }
}

function reset(column){
    if(gameState.turn == playerNum){
        //console.log(gameState.columns[column]);
        for(let i = 6 - gameState.columns[column]; i > 0; i--){
            document.getElementById(""+i+","+column+"").style.backgroundColor = "aliceblue";
        }
    }
}

function place(column){
    //console.log(gameState.turn);
    if(gameState.turn == playerNum && gameState.isDone != true && gameState.player1ready == true && gameState.player2ready){
        //onsole.log(playerTurn);
        if(gameState.columns[column] < 6 && winner == false){
            clicked = true;
            let height = gameState.columns[column] * (-1) + 6;

            document.getElementById(""+height+","+column+"").style.backgroundColor = "lightgreen";
            gameState.columns[column] += 1;
            if(gameState.columns[column] > highestVertical){
                highestVertical = gameState.columns[column];
            }
            gameState.board[column][height-1] = playerNum;
            //checkForWin(playerNum); MOVED SERVERSIDE :)
            //TODO: send data to server and do something with it. Cant remember what this is, think its done
            if(singlePlayerModeBool == false){
                socket.emit("brickplaced", {
                    game: gameState,
                    roomid: usethisRooomid,
                    placeCol: (column+1),
                    placeRow: height
                });
            } else if(singlePlayerModeBool == true){
                socket.emit("brickplaced", {
                    game: gameState,
                    roomid: "singleplayer",
                    placeCol: (column+1),
                    placeRow: height
                });
            }
        }
    }
}


/*

    CREATING THE CHAT, AND THE CHATTING STUFF

*/
function createChat(){
    let container = document.createElement("div");
    container.setAttribute("id", "chatCon");

    let chats = document.createElement("div");
    chats.setAttribute("id", "chats");

    let chatInp = document.createElement("textarea");
    chatInp.setAttribute("id", "chatInp");
    chatInp.setAttribute("autofocus", "");
    chatInp.setAttribute("placeholder", "Chat!");

    let sender = document.createElement("button");
    sender.setAttribute("onclick", "sendChat()");
    sender.setAttribute("id", "sendBut");
    let senderTxt = document.createTextNode("Send!");
    sender.appendChild(senderTxt);

    container.appendChild(chats);
    container.appendChild(chatInp);
    container.appendChild(sender);
    document.getElementById("gamebody").appendChild(container);
}

function sendChat(){
    //TODO: make this prettier and fancy at some point
    let msg = document.getElementById("chatInp").value;
    if(msg.length > 0){
        socket.emit("chatMsg", {
            room: usethisRooomid,
            msg: msg,
            player: playerNum
        })
    }
    document.getElementById("chatInp").value = "";
}

//send chats on enter key
$(document).on("keypress", "#chatInp", function(e){
    if(e.key == "Enter" && e.shiftKey == false){
        e.preventDefault();
        sendChat();
    }
})

//get the chat from the server and handle it on both clients
socket.on("chatRes", (data) => {
    handleChats(data.msg, data.player, "00");
})

function handleChats(msg, player, time){
    let chatMsgDiv = document.createElement("div");

    let msgP = document.createElement("p");
    let msgText = document.createTextNode(msg);

    msgP.appendChild(msgText);

    if(player == "1"){
        chatMsgDiv.setAttribute("class", "p1chat chatMsgContainer");
    } else if (player == "2"){
        chatMsgDiv.setAttribute("class", "p2chat chatMsgContainer");
    } else {
        chatMsgDiv.setAttribute("class", "adminMsg chatMsgContainer");
    }

    chatMsgDiv.appendChild(msgP);

    document.getElementById("chats").appendChild(chatMsgDiv);

    let element = document.getElementById("chats");
    element.scrollTop = element.scrollHeight;


}


/*

    FOR STARTING A NEW GAME

*/
socket.on("gameRes", (data) => {
    console.log(data);
    gameState = data;
    if(singlePlayerModeBool && !gameState.isDone){
        robotMove(gameState);
    }
    document.getElementById("player1points").innerHTML = gameState.points[0];
    document.getElementById("player2points").innerHTML = gameState.points[1];
    if(gameState.isDone){
        spil();
        blink(gameState.winArray);
        resetButton();
    } else {
        spil();
    }
})

function blink(win){
    for(let i = 0; i < win.length; i++){
        document.getElementById(""+(win[i][1])+","+(win[i][0]-1)+"").setAttribute('class', "onboards player"+win[0][2]+"s blink");
    }
}

function resetButton(){
    //console.log("reset");
    //playerTurn = 8;
    let button = document.createElement("button");
    let butText = document.createTextNode("Restart");
    button.appendChild(butText);
    button.setAttribute("id", "restart");
    button.setAttribute("onclick", "restart("+gameState.points[0]+", "+gameState.points[1]+", "+gameState.turn+")");
    let gamebody = document.getElementById("gamebody");
    let hasbutton = gamebody.querySelector("#restart") != null;
    if(!hasbutton){
        gamebody.appendChild(button);
    }
}

function restart(point1, point2, nextstarter){
    board = [[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]];
    columns = [0,0,0,0,0,0,0,0];
    winner = false;
    //playerTurn = 1;
    if(!singlePlayerModeBool){
        gameState = {
            turn: nextstarter,
            board: board,
            columns: columns,
            isDone: false,
            whoWon: "",
            points: [point1, point2]
        }

        socket.emit("playerReady", {
            room: usethisRooomid,
            player: playerNum
        });
        socket.emit("chatMsg", {
            room: usethisRooomid,
            msg: "player: " + playerNum + " wants to play again",
            player: "0"
        })
    } else {
        gameState = {
            turn: 1,
            board: board,
            columns: columns,
            isDone: false,
            whoWon: "",
            points: [point1, point2]
        }
    }

    document.getElementById("brickField").innerHTML = "";
    let restartBtn = document.getElementById("restart");
    document.getElementById("gamebody").removeChild(restartBtn);
    spil();
}

socket.on("playerIsReady", (data) => {
    console.log(gameState);
    if(data == 2){
        gameState.player2ready = true;
    } else if(data == 1){
        gameState.player1ready = true;
    } else {
        console.log("error");
    }
})


/*

    TO STAY IN ROOM ON RELOAD

*/
$(window).on("unload", (e)=>{
    //For making the cookie expire after 30 seconds
    if(ingame){
        setCookie("roomID", usethisRooomid);
        setCookie("game", JSON.stringify(gameState));
        setCookie("player", playerNum);
        setCookie("reloader", "true");
    }
})

$(window).on("load", (e)=>{
    if(reloader == "true"){
        if(getCookie("roomID") != "undefined" && getCookie("game") != "undefined" && getCookie("player") != "undefined"){
            //all cookies for rejoining are set, so rejoin :)
            let rejoinID = getCookie("roomID");
            let player = getCookie("player");
            socket.emit("rejoin", {
                rejoin: rejoinID,
                playerNum: player
            });
        }
    }
})

function setCookie(cookieName, value){
    let date = new Date();
    date.setTime(date.getTime()+(30*1000));
    let expires = "expires="+date.toUTCString();
    document.cookie = cookieName + "=" + value + ";" + expires + ";path=/";
}

function getCookie(cname) {
    let name = cname + "=";
    let ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function delete_cookie(name) {
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}


