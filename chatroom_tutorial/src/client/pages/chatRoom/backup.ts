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
type ChatHistoryResponse = Array<MessageResponseDto>;

const url = new URL(location.href);
const currentLoginUserId = url.searchParams.get("login_user");
const roomName = url.searchParams.get("room_name");
const fileUploadBtn = document.getElementById("fileUploadBtn")!;
const fileUploadInput = document.getElementById("fileUpload")!;
const otherUserId = url.searchParams.get("chat_with");
const headers = new Headers({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
});
let senderId = "";
let chatroomId = "";

// Call GET /user/me to get the user ID and save it
fetch("http://localhost:8080/api/v1/user/me", {
  headers: headers,
})
  .then((response) => response.json())
  .then((data) => {
    senderId = data.userId;
    console.log("sender ID: ", senderId);
  })
  .catch((error) => {
    console.error("Error fetching user data:", error);
  });

// 取得聊天室資訊
fetch(`http://localhost:8080/api/v1/chatrooms?chatWith=${otherUserId}`, {
  headers: headers,
})
  .then((response) => response.json())
  .then((data) => {
    chatroomId = data.chatroomId;
    console.log("ChatroomId:", chatroomId);

    // 连接和订阅
    connectAndSubscribe();

    // 获取历史聊天记录
    fetch(`http://localhost:8080/api/v1/chatrooms/${chatroomId}/messages`, {
      headers: headers,
    })
      .then((response) => response.json())
      .then((dataObj) => {
        // Check if dataObj.data is an array
        if (!Array.isArray(dataObj.data)) {
          console.error(
            "Error: chat history data is not an array",
            dataObj.data
          );
          return;
        }

        // 处理接收到的消息数据
        dataObj.data.forEach((message: MessageResponseDto) => {
          msgHandler(message);
        });

        // 等待一個畫面更新周期，確保新元素已被渲染
        setTimeout(() => {
          chatBoard.scrollTop = chatBoard.scrollHeight;
        }, 300);
      })
      .catch((error) => {
        console.error("Error fetching chat history:", error);
      });
  })
  .catch((error) => {
    console.error("Error fetching chatroom data:", error);
  });

fileUploadBtn.addEventListener("click", () => {
  fileUploadInput.click();
});

fileUploadInput.onchange = async (event) => {
  fileUploadInput.click();
};

fileUploadInput.addEventListener("change", async (event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) {
    return;
  }

  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("objectId", "6c26b077a3f047d89e20a8862a73e4df");
    formData.append("objectType", "CHATROOM");

    try {
      const response = await fetch("http://localhost:8080/api/v1/files", {
        method: "POST",
        body: formData,
        headers: headers,
      });
      if (!response.ok) {
        throw new Error("檔案上傳失敗");
      }

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
});

if (!currentLoginUserId || !roomName) {
  location.href = "/main/main.html";
}

// 建立連接 -> Spring Boot Server
const socket = new SockJS("http://localhost:8080/api/v1/ws");
const stompClient = Stomp.over(() => socket);
stompClient.debug = (str: string) => {
  console.log(str);
};

function connectAndSubscribe() {
  // 确保 chatroomId 已获得
  if (!chatroomId) {
    console.error(
      "chatroomId is not set. Aborting connection and subscription."
    );
    return;
  }

  stompClient.onConnect = (frame) => {
    // 加入聊天室
    stompClient.subscribe("/topic/" + roomName + "/join", (message) => {
      const msg = JSON.parse(message.body);
      roomMsgHandler(msg);
    });

    // 訂閱訊息
    stompClient.subscribe(`/chatrooms/${chatroomId}/message`, (message) => {
      console.log("Get message from backend");
      const msg = JSON.parse(message.body);
      console.log("Meesage from backend: ", message.body);
      msgHandler(msg);
    });

    // 离开聊天室
    stompClient.subscribe("/topic/" + roomName + "/leave", (message) => {
      const msg = JSON.parse(message.body);
      roomMsgHandler(msg);
    });
  };

  stompClient.connect(
    {},
    (frame: string) => {
      console.log("Connected: " + frame);
      console.log("成功連接");

      // 订阅消息
      stompClient.subscribe(
        "/chatrooms/" + chatroomId + "/message",
        (message) => {
          // 处理接收到的消息
          const data = JSON.parse(message.body);
          msgHandler(data);
        }
      );

      // 发送 join 事件
      stompClient.publish({
        destination: "/app/join",
        body: JSON.stringify({ userName: currentLoginUserId, roomName }),
      });
    },
    (error: string) => {
      console.log("STOMP error: " + error);
    }
  );
}

const textInput = document.getElementById("textInput") as HTMLInputElement;
const submitBtn = document.getElementById("submitBtn") as HTMLButtonElement;
const chatBoard = document.getElementById("chatBoard") as HTMLDivElement;
const headerRoomName = document.getElementById(
  "headerRoomName"
) as HTMLParagraphElement;
const backBtn = document.getElementById("backBtn") as HTMLButtonElement;

headerRoomName.innerText = roomName || " - ";

function msgHandler(data: MessageResponseDto) {
  // 只处理当前聊天室的消息
  if (data.chatroomId !== chatroomId) {
    return;
  }

  const date = new Date(data.sendDate);
  const time = `${date.getHours()}:${date.getMinutes()}`;

  const divBox = document.createElement("div");
  divBox.classList.add("flex", "mb-4", "items-end");

  if (data.messageType === "FILE") {
    const imageUrl = data.content;
    if (data.senderId === senderId) {
      divBox.classList.add("justify-end");
      divBox.innerHTML = `
        <p class="text-xs text-gray-700 mr-4">${time}</p>
        <div>
          <p class="text-xs text-white mb-1 text-right">${data.senderName}</p>
          <img
            class="mx-w-[50%] rounded-lg image-border" // 在这里添加新的类
            src="${imageUrl}"
          />
        </div>
      `;
    } else {
      divBox.classList.add("justify-start");
      divBox.innerHTML = `
        <div>
          <p class="text-xs text-gray-700 mb-1">${data.senderName}</p>
          <img
            class="mx-w-[50%] rounded-lg image-border" // 在这里添加新的类
            src="${imageUrl}"
          />
        </div>
        <p class="text-xs text-gray-700 ml-4">${time}</p>
      `;
    }
  } else {
    if (data.senderId === senderId) {
      divBox.classList.add("justify-end");
      divBox.innerHTML = `
      <p class="text-xs text-gray-700 mr-4">${time}</p>
      <div>
        <p class="text-xs text-white mb-1 text-right">${data.senderName}</p>
        <p
          class="mx-w-[50%] break-all bg-white px-4 py-2 rounded-bl-full rounded-br-full rounded-tl-full"
        >
          ${data.content}
        </p>
      </div>
    `;
    } else {
      divBox.classList.add("justify-start");
      divBox.innerHTML = `
      <div>
        <p class="text-xs text-gray-700 mb-1">${data.senderName}</p>
        <p
          class="mx-w-[50%] break-all bg-gray-800 px-4 py-2 rounded-tr-full rounded-br-full rounded-tl-full text-white"
        >
          ${data.content}
        </p>
      </div>
      <p class="text-xs text-gray-700 ml-4">${time}</p>
    `;
    }
  }

  console.log("收到的訊息： ", data);

  chatBoard.appendChild(divBox);
  textInput.value = "";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      chatBoard.scrollTop = chatBoard.scrollHeight;
    });
  });
}

function roomMsgHandler(msg: string) {
  const divBox = document.createElement("div");
  divBox.classList.add("flex", "justify-center", "mb-4", "items-center");
  divBox.innerHTML = `
    <p class="text-gray-700 text-sm">${msg}</p>
    `;
  chatBoard.append(divBox);
  chatBoard.scrollTop = chatBoard.scrollHeight;
}

function smoothScrollToBottom(element: HTMLElement, duration: number): void {
  const start = window.performance.now();
  const startTop = element.scrollTop;
  const endTop = element.scrollHeight - element.clientHeight;

  function step(timestamp: number) {
    const progress = Math.min(1, (timestamp - start) / duration);
    const currentTop = startTop + (endTop - startTop) * progress;

    element.scrollTop = currentTop;

    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  }

  window.requestAnimationFrame(step);
}

submitBtn.addEventListener("click", () => {
  const textValue = textInput.value;
  // 发送 chat 事件
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

backBtn.addEventListener("click", () => {
  location.href = "/main/main.html";
});
