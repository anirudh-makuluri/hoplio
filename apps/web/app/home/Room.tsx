"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  SmileIcon,
  ArrowLeft,
  ImageIcon,
  Paperclip,
  Clock,
  Lock,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { addChatDoc, setActiveRoomId } from "@/redux/chatSlice";
import { useUser } from "../providers";
import { ChatMessage, TPreviewImage } from "@/lib/types";
import ChatBubble from "@/components/ChatBubble";
import { sendMessageToServer } from "@/redux/socketSlice";
import { Avatar, AvatarImage } from "@radix-ui/react-avatar";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { saveFileToStorage, sleep, formatLastSeen } from "@/lib/utils";
import AIFeatures from "@/components/AIFeatures";
import ManageGroupDialog from "@/components/ManageGroupDialog";
import ScheduleMessageDialog from "@/components/ScheduleMessageDialog";
import ScheduledMessagesList from "@/components/ScheduledMessagesList";
import SemanticSearchBar from "@/components/SemanticSearchBar";
import {
  useFetchRoomMemberPublicKeys,
  useE2EEError,
  useEncryptRoomMessage,
  useDeviceId,
  useRotateIdentityKeys,
} from "@/lib/hooks/useE2EE";
import * as crypto from "@/lib/crypto";

export default function Room() {
  const { toast } = useToast();

  const activeChatRoomId = useAppSelector(
    (state) => state.chat.activeChatRoomId,
  );
  const activeRoom = useAppSelector(
    (state) => state.chat.rooms[activeChatRoomId] || {},
  );
  const socket = useAppSelector((state) => state.socket.socket);

  const dispatch = useAppDispatch();

  const user = useUser()?.user;
  const e2eeError = useE2EEError();
  const deviceId = useDeviceId();

  // E2EE hooks for room encryption
  const {
    memberPublicKeys,
    fetch: fetchKeys,
    loading: fetchingKeys,
  } = useFetchRoomMemberPublicKeys(activeChatRoomId);
  const { encrypt: encryptForRoom } = useEncryptRoomMessage(activeChatRoomId);
  const { rotate: rotateKeys, loading: rotatingKeys } = useRotateIdentityKeys();
  const [encryptionStatus, setEncryptionStatus] = useState<
    "idle" | "encrypting" | "sending"
  >("idle");

  const presenceText = (() => {
    if (!user) return "";
    const userRoom = (user.rooms || []).find(
      (r) => r.roomId === activeChatRoomId,
    );
    if (!userRoom || userRoom.is_group) return "";
    const other = (userRoom.membersData || []).find(
      (m: any) => m.uid !== user.uid,
    );
    if (!other) return "";
    if (other.is_online) return "Online";
    return other.last_seen
      ? `Last seen ${formatLastSeen(other.last_seen)}`
      : "";
  })();

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [input, setInput] = useState<string>("");
  const [prevMsgCnt, setPrevMsgCnt] = useState<number>(
    activeRoom?.messages?.length || 0,
  );
  const [isNewChatDocLoading, setIsNewChatDocLoading] =
    useState<Boolean>(false);
  const [previewImages, setPreviewImages] = useState<TPreviewImage[]>([]);
  const [encryptThisMessage, setEncryptThisMessage] = useState(false);
  const [lastMessageContent, setLastMessageContent] = useState<string>("");

  const generateMessageId = () =>
    `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  // Fetch member public keys when room changes (for all room types)
  useEffect(() => {
    if (activeChatRoomId) {
      fetchKeys().catch((err) => {
        console.error("Failed to fetch member keys:", err);
      });
    }
  }, [activeChatRoomId, fetchKeys]);

  // Track last message for smart replies
  useEffect(() => {
    const messages = activeRoom?.messages || [];
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && !lastMsg.isDate && lastMsg.chatInfo) {
        setLastMessageContent(lastMsg.chatInfo);
      }
    }
  }, [activeRoom?.messages]);

  useEffect(() => {
    if (activeChatRoomId != "") {
      textAreaRef.current?.focus();
    }
  }, [activeChatRoomId]);

  useEffect(() => {
    setTimeout(() => {
      if (!messagesContainerRef.current || isNewChatDocLoading) return;
      setPrevMsgCnt(activeRoom.messages.length);

      scrollToBottom();
    }, 500);
  }, [activeRoom?.messages, isNewChatDocLoading]);

  const sendMessage = async () => {
    if ((input.trim() == "" || input == null) && previewImages.length == 0)
      return;

    if (!user) {
      toast({
        title: "Error",
        description: "User not logged in",
      });
      return;
    }

    // Handle image messages
    previewImages.forEach(async (data) => {
      const id = generateMessageId();
      const storagePath = `${activeChatRoomId}/${id}`;
      const downloadUrl = await saveFileToStorage(
        data.file,
        storagePath,
        user.uid,
      );

      const chatMessage: ChatMessage = {
        id,
        roomId: activeChatRoomId,
        type: "image",
        chatInfo: downloadUrl,
        userUid: user.uid,
        userPhoto: user.photo_url,
        time: new Date(),
        userName: user.name,
        fileName: data.file.name,
      };

      dispatch(sendMessageToServer(chatMessage));
    });

    if (input.trim() == "" || input == null) return;

    if (
      encryptThisMessage &&
      memberPublicKeys &&
      Object.keys(memberPublicKeys).length > 0
    ) {
      try {
        setEncryptionStatus("encrypting");

        // Encrypt message for all room members (each user's each device)
        await crypto.initiateSodium();
        const encryptedForRecipients = encryptForRoom(input);

        if (!encryptedForRecipients) {
          throw new Error("Encryption failed");
        }

        setEncryptionStatus("sending");

        const chatMessage: ChatMessage = {
          id: generateMessageId(),
          roomId: activeChatRoomId,
          type: "text",
          chatInfo: "", // Don't send plaintext
          userUid: user.uid,
          userName: user.name,
          userPhoto: user.photo_url,
          time: new Date(),
          isEncrypted: true,
          encrypted: encryptedForRecipients, // Contains encryption for every recipient device
        };

        dispatch(sendMessageToServer(chatMessage));

        setInput("");
        setPreviewImages([]);
        setEncryptionStatus("idle");
      } catch (err) {
        console.error("Encryption/send failed:", err);
        setEncryptionStatus("idle");

        // Fallback to unencrypted message
        toast({
          title: "Warning",
          description: "Encryption failed. Try again or send unencrypted.",
          variant: "destructive",
        });
      }
    } else {
      // Send unencrypted message
      const chatMessage: ChatMessage = {
        id: generateMessageId(),
        roomId: activeChatRoomId,
        type: "text",
        chatInfo: input,
        userUid: user.uid,
        userName: user.name,
        userPhoto: user.photo_url,
        time: new Date(),
      };

      dispatch(sendMessageToServer(chatMessage));
      setInput("");
      setPreviewImages([]);
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;

      if (container.scrollTop === 0) {
        const currentPosition = container.scrollHeight;
        if (!socket) return;

        setIsNewChatDocLoading(true);
        const roomId = activeChatRoomId;
        const curChatDocId = activeRoom?.messages?.[1]?.chatDocId;
        socket.emit(
          "load_chat_doc_from_db",
          { roomId, curChatDocId },
          async (response: any) => {
            if (response.success) {
              dispatch(
                addChatDoc({
                  messages: response.chat_history,
                  roomId,
                  userId: user?.uid,
                  deviceId,
                }),
              );
              await sleep(100);
              container.scrollTop = container.scrollHeight - currentPosition;
              setIsNewChatDocLoading(false);
            } else {
              console.log(response);
            }
          },
        );
      }
    }
  };

  function onEmojiClick(e: EmojiClickData) {
    if (textAreaRef.current == null) return;

    const cursorPosition = textAreaRef.current.selectionStart;
    const newInput =
      input.slice(0, cursorPosition) + e.emoji + input.slice(cursorPosition);
    setInput(newInput);
  }

  function handleBackButton() {
    dispatch(setActiveRoomId(""));
  }

  async function handleRotateKeys() {
    if (!user?.uid) {
      toast({
        title: "Error",
        description: "You need to be signed in to rotate E2EE keys.",
        variant: "destructive",
      });
      return;
    }

    try {
      await rotateKeys(user.uid);
      await fetchKeys();
      toast({
        title: "Success",
        description:
          "E2EE keys rotated successfully. Fingerprint has been updated.",
      });
    } catch (error) {
      console.error("Failed to rotate keys:", error);
      toast({
        title: "Error",
        description: "Failed to rotate E2EE keys. Please try again.",
        variant: "destructive",
      });
    }
  }

  function openImageChoose() {
    if (!imageRef.current) return;

    imageRef.current.click();

    imageRef.current.onchange = (e: any) => {
      const files = e.target?.files;
      if (files) {
        const imageData: TPreviewImage[] = Array.from(files).map(
          (file: any) => {
            return {
              url: URL.createObjectURL(file),
              file: file,
            };
          },
        );

        const newPreviewImages = [...previewImages, ...imageData];
        setPreviewImages(newPreviewImages);
      }
    };
  }

  function removePreviewImage(index: number) {
    let newPreviewImages = [...previewImages];
    newPreviewImages.splice(index, 1);
    setPreviewImages(newPreviewImages);
  }

  async function uploadDocumentFiles(files: FileList | null) {
    if (!files || !user) return;

    for (const file of Array.from(files)) {
      const id = generateMessageId();
      const storagePath = `${activeChatRoomId}/${id}-${file.name}`;
      const downloadUrl = await saveFileToStorage(file, storagePath, user.uid);
      const chatMessage: ChatMessage = {
        id,
        roomId: activeChatRoomId,
        type: "file",
        chatInfo: downloadUrl,
        userUid: user.uid,
        userName: user.name,
        userPhoto: user.photo_url,
        time: new Date(),
        fileName: file.name,
      };

      dispatch(sendMessageToServer(chatMessage));
    }
  }

  function openDocumentChoose() {
    if (!fileRef.current) return;

    fileRef.current.click();
    fileRef.current.onchange = async (e: any) => {
      await uploadDocumentFiles(e.target?.files || null);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    };
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex w-full flex-shrink-0 flex-row items-center justify-start gap-4 border-b border-white/10 bg-slate-950/68 px-4 py-4 backdrop-blur-xl">
        <Button
          onClick={handleBackButton}
          variant={"ghost"}
          className="block sm:hidden"
        >
          <ArrowLeft />
        </Button>
        <Avatar className="rounded-full border border-white/10">
          <AvatarImage
            src={activeRoom.photo_url}
            className="h-10 w-10 rounded-full"
          />
        </Avatar>
        <div className="flex flex-col">
          <p className="font-medium text-slate-50">{activeRoom.name}</p>
          {presenceText && (
            <span className="text-xs text-muted-foreground">{presenceText}</span>
          )}
        </div>
        {activeRoom.is_ai_room != true && (
          <SemanticSearchBar roomId={activeChatRoomId} />
        )}
        <div className="ml-auto flex items-center gap-2">
          {e2eeError && (
            <Button
              onClick={handleRotateKeys}
              variant="outline"
              size="sm"
              disabled={rotatingKeys || fetchingKeys}
              title="Rotate E2EE keys to fix fingerprint mismatch"
            >
              <RotateCcw
                size={16}
                className="text-yellow-600 dark:text-yellow-400"
              />
            </Button>
          )}
          {activeRoom.is_group && (
            <ManageGroupDialog
              room={activeRoom}
              allFriends={user?.friend_list || []}
            />
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-gradient-to-b from-cyan-500/5 via-transparent to-blue-500/5 px-4 py-4"
      >
        {activeRoom?.messages?.map((message, index) => (
          <ChatBubble
            key={index}
            message={message}
            roomId={activeChatRoomId}
            isGroup={activeRoom.is_group}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section - Fixed at bottom */}
      <div className="flex-shrink-0 border-t border-white/10 bg-slate-950/72 backdrop-blur-xl">
        {/* Preview Images */}
        {previewImages.length > 0 && (
          <div className="flex flex-row gap-4 overflow-x-auto px-4 pt-3">
            {previewImages.map((data, index) => (
              <div key={index} className="group relative flex-shrink-0">
                <Image
                  className="rounded-xl border border-white/10"
                  width={64}
                  height={64}
                  alt="Image"
                  src={data.url}
                />
                <div
                  onClick={() => removePreviewImage(index)}
                  className="absolute right-1 top-1 hidden cursor-pointer rounded-full bg-slate-950/55 px-1.5 py-0.5 text-xs text-white group-hover:flex"
                >
                  Remove
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Features Component */}
        <AIFeatures
          input={input}
          setInput={setInput}
          onAISend={scrollToBottom}
          lastMessage={lastMessageContent}
        />

        {/* Input Area */}
        <div className="px-4 pb-3">
          {/* Encryption Status Indicator */}
          {memberPublicKeys &&
            Object.keys(memberPublicKeys).length > 0 &&
            encryptThisMessage && (
              <div
                className={`flex items-center gap-2 mb-2 text-xs text-green-600 dark:text-green-400`}
              >
                <Lock size={14} />
                <span>This message will be encrypted.</span>
              </div>
            )}

          {/* Error Display */}
          {e2eeError && (
            <div className="flex items-center gap-2 mb-2 text-xs text-red-600 dark:text-red-400">
              <span>Warning: {e2eeError}</span>
            </div>
          )}

          <Textarea
            ref={textAreaRef}
            onKeyDown={(e) => {
              if (e.key == "Enter") sendMessage();
            }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message here"
            className="min-h-[60px] max-h-[120px] rounded-2xl border-white/10 bg-slate-900/80 shadow-sm backdrop-blur-sm"
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} size="sm">
                    <SmileIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="bg-transparent border-0">
                  <EmojiPicker
                    onEmojiClick={(e) => onEmojiClick(e)}
                    theme={Theme.DARK}
                  />
                </PopoverContent>
              </Popover>
              <Button onClick={openImageChoose} variant={"outline"} size="sm">
                <ImageIcon />
                <Input
                  className="hidden"
                  ref={imageRef}
                  type="file"
                  accept="image/*"
                  multiple
                />
              </Button>
              <Button
                onClick={openDocumentChoose}
                variant={"outline"}
                size="sm"
              >
                <Paperclip />
                <Input className="hidden" ref={fileRef} type="file" multiple />
              </Button>
              <ScheduleMessageDialog roomId={activeChatRoomId}>
                <Button variant={"outline"} size="sm">
                  <Clock />
                </Button>
              </ScheduleMessageDialog>
              <ScheduledMessagesList
                roomId={activeChatRoomId}
                userUid={user?.uid || ""}
              />
            </div>
            <div className="flex self-end sm:self-auto">
              {memberPublicKeys && Object.keys(memberPublicKeys).length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button className="rounded-r-none" size="xs">
                      <ChevronUp size={16} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="" align="end">
                    <div className="flex flex-col gap-2">
                      <div
                        className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() =>
                          setEncryptThisMessage(!encryptThisMessage)
                        }
                      >
                        <div
                          className={`w-4 h-4 rounded ${encryptThisMessage ? "bg-green-600 dark:bg-green-400" : "border border-gray-300"}`}
                        />
                        <span className="text-sm whitespace-nowrap">
                          {encryptThisMessage
                            ? "Send without encryption"
                            : "Encrypt this message"}
                        </span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <Button
                disabled={
                  ((input.trim() == "" || input == null) &&
                    previewImages.length == 0) ||
                  encryptionStatus !== "idle" ||
                  fetchingKeys
                }
                onClick={sendMessage}
                size="sm"
                className="rounded-l-none"
              >
                {encryptionStatus !== "idle" ? (
                  <>Encrypting and sending...</>
                ) : encryptThisMessage ? (
                  <>
                    <Lock size={16} className="mr-1" />
                    <Send size={16} />
                  </>
                ) : (
                  <Send />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
