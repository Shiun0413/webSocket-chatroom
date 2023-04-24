import "./index.css";

// 獲取 HTML 元素的引用
const nameInput = document.getElementById("nameInput") as HTMLInputElement;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const roomSelect = document.getElementById("roomSelect") as HTMLSelectElement;

// 設置請求標頭，包含從 localStorage 獲取的授權令牌
const headers = new Headers({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
});

// 儲存當前登入用戶的 ID
let currentLoginUserId = "";

type ChatRoom = {
  chatroomId: string;
  currentLoginUserId: string;
  totalUnreadMessage: number;
  updateDate: string;
  latestMessageContent: string;
  otherUser: {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
  };
};

// 發送 GET /user/me 請求以獲取目前登入用戶 ID 並保存
fetch("http://localhost:8080/api/v1/user/me", {
  headers: headers,
})
  .then((response) => response.json())
  .then((data) => {
    currentLoginUserId = data.userId;
    console.log("currentLoginUser ID: ", currentLoginUserId);

    // 將獲取到的用戶名放入 "YOUR NAME" 輸入框
    nameInput.value = "當前登錄者：" + data.fullName;

    // 將 "YOUR NAME" 輸入框設置為禁用狀態
    nameInput.disabled = true;
  })
  .catch((error) => {
    console.error("Error fetching user data:", error);
  });

// 發送請求以獲取聊天室列表
fetch("http://localhost:8080/api/v1/chatrooms", {
  headers: headers,
})
  .then((response) => response.json())
  .then((data: { data: ChatRoom[] }) => {
    if (!Array.isArray(data.data)) {
      console.error("Error: chat room data is not an array", data.data);
      return;
    }

    // 渲染聊天室列表
    renderChatRoomList(data.data);
  })
  .catch((error) => {
    console.error("Error fetching chat room data:", error);
  });

// 為開始按鈕添加 click 事件監聽器，導航到選擇的聊天室
startBtn.addEventListener("click", () => {
  const selectedOption = roomSelect.options[roomSelect.selectedIndex];
  const selectedOtherUserId = JSON.parse(selectedOption.value).otherUser.userId;
  const selectedChatroom = JSON.parse(selectedOption.value) as ChatRoom;

  location.href = `/chatRoom/chatRoom.html?chatroom_id=${selectedChatroom.chatroomId}&login_user=${currentLoginUserId}&room_name=${selectedChatroom.otherUser.fullName}&chat_with=${selectedOtherUserId}`;
});

// 渲染聊天室列表的函數
function renderChatRoomList(chatrooms: ChatRoom[]) {
  // 遍歷聊天室數據並將其添加到下拉列表中
  chatrooms.forEach((chatroom) => {
    const option = document.createElement("option");
    option.value = JSON.stringify(chatroom);
    option.text = chatroom.otherUser.fullName;
    roomSelect.add(option);
  });
}
