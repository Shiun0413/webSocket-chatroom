export type UserData = {
  senderId: string;
  senderName: string;
  roomName: string;
};

export default class UserService {
  // 紀錄使用者的資訊
  private userMap: Map<string, UserData>;

  constructor() {
    this.userMap = new Map();
  }

  addUser(data: UserData) {
    this.userMap.set(data.senderId, data);
  }

  removeUser(id: string) {
    if (this.userMap.has(id)) {
      this.userMap.delete(id);
    }
  }

  getUser(id: string) {
    if (!this.userMap.has(id)) return null;

    const data = this.userMap.get(id);
    if (data) {
      return data;
    }

    return null;
  }

  userDataInfoHandler(
    senderId: string,
    senderName: string,
    roomName: string
  ): UserData {
    return {
      senderId,
      senderName,
      roomName,
    };
  }
}
