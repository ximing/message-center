import { describe, expect, it } from 'vitest';
import { classifyWechatType, normalizeWechatMessage, parseGroupMessage } from './parse.js';

describe('classifyWechatType', () => {
  it('recognizes text, link, image, and voice', () => {
    expect(classifyWechatType(1)).toBe('text');
    expect(classifyWechatType(49)).toBe('link');
    expect(classifyWechatType(0x10000 | 49)).toBe('link');
    for (const type of [3, 13, 23, 33, 39]) expect(classifyWechatType(type)).toBe('image');
    expect(classifyWechatType(34)).toBe('voice');
    expect(classifyWechatType(2)).toBeNull();
  });
});

describe('parseGroupMessage', () => {
  const room = '12345@chatroom';

  it('splits a chatroom body on colon-newline when the prefix is a wxid', () => {
    expect(parseGroupMessage(room, 'wxid_abc:\nhello')).toEqual({
      group: true,
      talker: room,
      sender: 'wxid_abc',
      body: 'hello',
    });
  });

  it('splits on the first colon when there is no newline', () => {
    expect(parseGroupMessage(room, 'wxid_sender:你好')).toMatchObject({
      sender: 'wxid_sender',
      body: '你好',
    });
  });

  it('accepts a prefix that contains @', () => {
    expect(parseGroupMessage(room, 'a@b:\nhi')).toMatchObject({ sender: 'a@b', body: 'hi' });
  });

  it('keeps the raw body when the prefix is not a sender', () => {
    expect(parseGroupMessage(room, 'hello:world')).toEqual({
      group: true,
      talker: room,
      sender: '',
      body: 'hello:world',
    });
  });

  it('does not split a direct message', () => {
    expect(parseGroupMessage('wxid_friend', 'wxid_other:\nnope')).toMatchObject({
      group: false,
      sender: '',
      body: 'wxid_other:\nnope',
    });
  });
});

describe('normalizeWechatMessage', () => {
  it('uses fromUser for a direct message and leaves room empty', () => {
    expect(
      normalizeWechatMessage({
        talker: 'wxid_me',
        fromUser: 'wxid_friend',
        content: 'hi',
      }),
    ).toEqual({ sender: 'wxid_friend', room: null, body: 'hi' });
  });

  it('falls back to talker when fromUser is empty', () => {
    expect(
      normalizeWechatMessage({ talker: 'wxid_friend', fromUser: '', content: 'hi' }),
    ).toEqual({ sender: 'wxid_friend', room: null, body: 'hi' });
  });

  it('uses the group prefix and the chatroom talker as the room', () => {
    expect(
      normalizeWechatMessage({
        talker: 'room@chatroom',
        fromUser: 'ignored',
        content: 'wxid_abc:\nhello',
      }),
    ).toEqual({ sender: 'wxid_abc', room: 'room@chatroom', body: 'hello' });
  });
});
