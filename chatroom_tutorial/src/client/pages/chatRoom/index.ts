import "./index.css";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

type MessageResponseDto = {
  senderId: string;
  chatroomId: string;
  content: string;
  senderName: string;
  sendDate: Date;
  messageType: "TEXT" | "FILE";
};

type UserData = {
  userId: string;
};

const url = new URL(location.href);
const currentLoginUserId = url.searchParams.get("login_user");
const roomName = url.searchParams.get("room_name");
const fileUploadBtn = document.getElementById("fileUploadBtn")!;
const fileUploadInput = document.getElementById("fileUpload")!;
const otherUserId = url.searchParams.get("chat_with");
const headers = new Headers({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
});

let stompClient = Stomp.over(() => "");
let senderId = "";
let chatroomId = "";

// 定義 fetchApi 函數
async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  // 初始化請求頭
  options.headers = options.headers || new Headers();
  // 設置認證令牌到請求頭
  (options.headers as Headers).set(
    "Authorization",
    `Bearer ${localStorage.getItem("jwtToken")}`
  );
  // 發送請求
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Error fetching data from ${url}`);
  }
  return response.json() as Promise<T>;
}

// 定義 getUserIdAndChatroomId 函數
async function getUserIdAndChatroomId() {
  try {
    // 獲取用戶數據
    const userData: { userId: string } = await fetchApi<UserData>(
      "http://localhost:8080/api/v1/user/me"
    );
    senderId = userData.userId;
    console.log("sender ID: ", senderId);

    // 獲取聊天室數據
    const chatroomData: { chatroomId: string } = await fetchApi(
      `http://localhost:8080/api/v1/chatrooms?chatWith=${otherUserId}`
    );
    chatroomId = chatroomData.chatroomId;
    console.log("ChatroomId:", chatroomId);

    // 獲取歷史聊天記錄
    const chatHistoryDataObj: { data: MessageResponseDto[] } = await fetchApi(
      `http://localhost:8080/api/v1/chatrooms/${chatroomId}/messages`
    );

    // 檢查 chatHistoryDataObj.data 是否為數組
    if (!Array.isArray(chatHistoryDataObj.data)) {
      console.error(
        "Error: chat history data is not an array",
        chatHistoryDataObj.data
      );
      return;
    }

    // 處理接收到的消息數據
    chatHistoryDataObj.data.forEach((message: MessageResponseDto) => {
      displayMsgHandler(message);
    });

    // 等待一個畫面更新周期，確保新元素已被渲染
    setTimeout(() => {
      chatBoard.scrollTop = chatBoard.scrollHeight;
    }, 300);
  } catch (error) {
    console.error("Error fetching user/chatroom data:", error);
  }

  // 連接WebSocket 然後 訂閱
  connectAndSubscribe();
}

// 執行 getUserIdAndChatroomId 函數
getUserIdAndChatroomId();

// 檢查當前登錄用戶 ID 和房間名稱是否存在，若不存在則返回主頁面
if (!currentLoginUserId || !roomName) {
  location.href = "/main/main.html";
}

function connectAndSubscribe() {
  // 確保已獲取 chatroomId
  if (!chatroomId) {
    console.error(
      "chatroomId is not set. Aborting connection and subscription."
    );
    return;
  }

  // 建立連接 -> Spring Boot Server
  const socket = new SockJS("http://localhost:8080/api/v1/ws");
  stompClient = Stomp.over(() => socket);
  // 設置 Stomp 客戶端調試信息
  stompClient.debug = (str: string) => {
    console.log(str);
  };

  console.log("即將進入stompClient.connect");
  // 建立 Stomp 連接
  stompClient.connect(
    {},
    (frame: string) => {
      console.log("Connected: " + frame);
      console.log("成功連接");

      // 訂閱消息
      stompClient.subscribe(
        "/chatrooms/" + chatroomId + "/message",
        (message) => {
          // 處理接收到的消息
          const data = JSON.parse(message.body);
          displayMsgHandler(data);
        }
      );

      // // 發送 join 事件
      // stompClient.publish({
      //   destination: "/app/join",
      //   body: JSON.stringify({ userName: currentLoginUserId, roomName }),
      // });
    },
    (error: string) => {
      console.log("STOMP error: " + error);
    }
  );

  // 連接建立成功時執行的回調函數
  stompClient.onConnect = (frame) => {
    // 加入聊天室
    stompClient.subscribe("/topic/" + roomName + "/join", (message) => {
      const msg = JSON.parse(message.body);
      roomMsgHandler(msg);
    });

    console.log("我在stompClient.onConnect");

    // 訂閱訊息
    stompClient.subscribe(`/chatrooms/${chatroomId}/message`, (message) => {
      console.log("Get message from backend");
      const msg = JSON.parse(message.body);
      console.log("Meesage from backend: ", message.body);
      displayMsgHandler(msg);
    });

    // 離開聊天室
    stompClient.subscribe("/topic/" + roomName + "/leave", (message) => {
      const msg = JSON.parse(message.body);
      roomMsgHandler(msg);
    });
  };
}

// 獲取 DOM 元素
const textInput = document.getElementById("textInput") as HTMLInputElement;
const submitBtn = document.getElementById("submitBtn") as HTMLButtonElement;
const chatBoard = document.getElementById("chatBoard") as HTMLDivElement;
const headerRoomName = document.getElementById(
  "headerRoomName"
) as HTMLParagraphElement;
const backBtn = document.getElementById("backBtn") as HTMLButtonElement;

// 將房間名稱設置為 headerRoomName 的文本內容
headerRoomName.innerText = roomName || " - ";

// displayMsgHandler 函數用於處理和顯示收到的消息
function displayMsgHandler(data: MessageResponseDto) {
  // 只處理當前聊天室的消息
  if (data.chatroomId !== chatroomId) {
    return;
  }

  // 將收到的消息的發送時間轉換為 Date 對象，並格式化時間字符串
  const date = new Date(data.sendDate);
  const time = `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;

  let divBox: HTMLDivElement;

  // 判斷消息類型，分別處理文件消息和文本消息
  if (data.messageType === "FILE") {
    if (data.senderId === senderId) {
      divBox = renderSenderFileMessage(data, time);
    } else {
      divBox = renderReceiverFileMessage(data, time);
    }
  } else {
    // 處理文本消息
    if (data.senderId === senderId) {
      divBox = renderSenderTextMessage(data, time);
    } else {
      divBox = renderReceiverTextMessage(data, time);
    }
  }

  // 打印收到的訊息到控制台
  console.log("收到的訊息： ", data);

  // 將新建的 divBox 元素添加到 chatBoard 中
  chatBoard.appendChild(divBox);
  // 清空輸入框的內容
  textInput.value = "";
  // 使用 requestAnimationFrame 確保 DOM 更新後再執行滾動操作
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      chatBoard.scrollTop = chatBoard.scrollHeight;
    });
  });
}

// roomMsgHandler 函數用於處理和顯示聊天室的加入和離開消息
function roomMsgHandler(msg: string) {
  // 創建一個 divBox 元素，添加所需的 CSS 類，並設置其內部 HTML
  const divBox = document.createElement("div");
  divBox.classList.add("flex", "justify-center", "mb-4", "items-center");
  divBox.innerHTML = `
    <p class="text-gray-700 text-sm">${msg}</p>
    `;
  // 將 divBox 添加到 chatBoard，並滾動到底部
  chatBoard.append(divBox);
  chatBoard.scrollTop = chatBoard.scrollHeight;
}

// 渲染發送方文件消息的函數
function renderSenderFileMessage(data: MessageResponseDto, time: string) {
  const divBox = document.createElement("div");
  divBox.classList.add("flex", "mb-4", "items-end", "justify-end");
  divBox.innerHTML = `
    <p class="text-xs text-gray-700 mr-4">${time}</p>
    <div>
      <p class="text-xs text-white mb-1 text-right">${data.senderName}</p>
      <img
        class="mx-w-[50%] rounded-lg image-border"
        src="${data.content}"
      />
    </div>
  `;
  return divBox;
}

// 渲染接收方文件消息的函數
function renderReceiverFileMessage(data: MessageResponseDto, time: string) {
  const divBox = document.createElement("div");
  divBox.classList.add("flex", "mb-4", "items-end", "justify-start");
  divBox.innerHTML = `
    <div>
      <p class="text-xs text-gray-700 mb-1">${data.senderName}</p>
      <img
        class="mx-w-[50%] rounded-lg image-border"
        src="${data.content}"
      />
    </div>
    <p class="text-xs text-gray-700 ml-4">${time}</p>
  `;
  return divBox;
}

// 渲染發送方文本消息的函數
function renderSenderTextMessage(data: MessageResponseDto, time: string) {
  const divBox = document.createElement("div");
  divBox.classList.add("flex", "mb-4", "items-end", "justify-end");
  divBox.innerHTML = `
    <p class="text-xs text-gray-700 mr-4">${time}</p>
    <div>
      <p class="text-xs text-white mb-1 text-right">${data.senderName}</p>
      <p class="bg-indigo-500 text-white px-4 py-2 rounded-lg inline-block">${data.content}</p>
    </div>
  `;
  return divBox;
}

// 渲染接收方文本消息的函數
function renderReceiverTextMessage(data: MessageResponseDto, time: string) {
  const divBox = document.createElement("div");
  divBox.classList.add("flex", "mb-4", "items-end", "justify-start");
  divBox.innerHTML = `
    <div>
      <p class="text-xs text-gray-700 mb-1">${data.senderName}</p>
      <p class="bg-gray-300 text-black px-4 py-2 rounded-lg inline-block">${data.content}</p>
    </div>
    <p class="text-xs text-gray-700 ml-4">${time}</p>
  `;
  return divBox;
}

// 用於將單位數字補零，使其顯示為兩位數的函數，例如：上午9點8分，要是09:08，不會是9:8
function padZero(number: number): string {
  return number.toString().padStart(2, "0");
}

// 為 submitBtn 添加 click 事件監聽器，用於發送聊天消息
submitBtn.addEventListener("click", () => {
  const textValue = textInput.value;
  // 發送 chat 事件
  stompClient.publish({
    destination: "/app/send-message",
    body: JSON.stringify({
      chatroomId: chatroomId,
      content: textValue,
      senderId: senderId,
      messageType: "TEXT",
    }),
  });
});

// 為 fileUploadBtn 添加 click 事件監聽器，用於打開文件選擇對話框
fileUploadBtn.addEventListener("click", () => {
  fileUploadInput.click();
});

// 當選擇了文件後，上傳文件
fileUploadInput.onchange = async (event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) {
    return;
  }

  // 遍歷選擇的文件，進行上傳
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("objectId", chatroomId);
    formData.append("objectType", "CHATROOM");

    try {
      // 向伺服器發送文件上傳請求
      const response = await fetch("http://localhost:8080/api/v1/files", {
        method: "POST",
        body: formData,
        headers: headers,
      });
      if (!response.ok) {
        throw new Error("檔案上傳失敗");
      }

      // 獲取上傳成功的文件列表
      const fileList = await response.json();
      const fileUrl = fileList[0];

      // 發送 chat 事件，附帶檔案資訊
      stompClient.publish({
        destination: "/app/send-message",
        body: JSON.stringify({
          chatroomId: chatroomId,
          content: fileUrl,
          senderId: senderId,
          messageType: "FILE",
        }),
      });

      // 等待一個畫面更新周期，確保新元素已被渲染
      setTimeout(() => {
        chatBoard.scrollTop = chatBoard.scrollHeight;
      }, 400);
    } catch (error) {
      console.error("檔案上傳出錯:", error);
    }
  }

  // 清空 input，以便於下次選擇相同檔案時仍能觸發 change 事件
  target.value = "";
};

// 為 backBtn 添加 click 事件監聽器，返回主頁面
backBtn.addEventListener("click", () => {
  location.href = "/main/main.html";
});
