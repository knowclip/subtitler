import { newId } from "./newId";

export type Caption = {
  text: string;
  uuid: string;
};

export const caption = (text: string): Caption => ({
  text,
  uuid: newId(),
});
