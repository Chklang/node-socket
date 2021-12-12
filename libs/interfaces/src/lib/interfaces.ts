export type TMessagesTypes = 'first-message' | 'next-message' | 'end-message' |'error-message';
export interface IMessageContent<T extends TMessagesTypes> {
  type: T;
}
export interface IMessage<T extends IMessageContent<TMessagesTypes>> {
  id: string;
  content: T;
}

export interface IFirstMessageContent<Type extends string, Content> extends IMessageContent<'first-message'> {
  subject: Type;
  body: Content;
}
export interface IFirstMessage<Type extends string, Content> extends IMessage<IFirstMessageContent<Type, Content>> { }

export interface INextMessageContent<Content> extends IMessageContent<'next-message'> {
  body: Content;
}
export interface INextMessage<Content> extends IMessage<INextMessageContent<Content>> { }

export interface IEndMessageContent extends IMessageContent<'end-message'> { }
export interface IEndMessage extends IMessage<IEndMessageContent> { }

export interface IErrorMessageContent extends IMessageContent<'error-message'> {
  error: string;
}
export interface IErrorMessage extends IMessage<IErrorMessageContent> { }

export type TMessage = IMessage<IMessageContent<TMessagesTypes>>;
export type TFirstMessage = IFirstMessage<string, any>;
export type TNextMessage = INextMessage<any>;
export type TEndMessage = IEndMessage;
export type TErrorMessage = IErrorMessage;