"use client";

import Image from "next/image";
import { useContext, useEffect, useRef, useState } from "react";
import audioIcon from "../../../../public/assets/images/audio.png";
import ArrowIcon from "../../../../public/assets/images/backArrow.svg";
import DictionaryIcon from "../../../../public/assets/images/book.svg";
import BookmarkIcon from "../../../../public/assets/images/bookmark.svg";
import closeButton from "../../../../public/assets/images/close.png";
import {
  DictionaryContext,
  type SelectedDefinition,
} from "./DictionaryContext";

async function getBookmark(word: string) {
  //temp
  return false;
}

export default function Dictionary() {
  const fullDictionary = useContext(DictionaryContext);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [bookmark, setBookmark] = useState<boolean | undefined>(false);

  useEffect(() => {
    if (fullDictionary?.word) {
      setBookmark(fullDictionary.word.bookmarked);
    }
  }, [fullDictionary?.word]);

  useEffect(() => {
    if (fullDictionary?.dictionary) {
      // check if bookmarks need to be grabbed?
      let copyDict = Object.assign({}, fullDictionary.dictionary);
      const words = Object.keys(copyDict);

      words.forEach((word, index) => {
        if (copyDict[word].bookmarked === undefined) {
          (async () => {
            copyDict[word].bookmarked = await getBookmark(word);
            if (index == words.length - 1) {
              //we got all the words fixed?
              console.log("bookmarked? : ", copyDict);
              fullDictionary.setDictionary(copyDict);
            }
          })();
        }
      });
    }

    if (sidebarRef.current) {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("scroll", handleScroll);
    }

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function handleClick(e: MouseEvent) {
    if (!sidebarRef.current?.contains(e.target as Node)) {
      fullDictionary?.setOpen(false);
    }
  }

  function handleScroll(e: Event) {
    fullDictionary?.setOpen(false);
  }

  if (fullDictionary) {
    return (
      <>
        <div
          ref={sidebarRef}
          className={`${
            fullDictionary.open ? "" : "max-w-0 "
          } fixed inset-y-0 right-0 z-10 flex h-screen w-screen flex-col justify-between self-end border-sciquelTeal bg-sciquelCardBg pt-20 md:w-96`}
        >
          {/* outer dictionary */}
          <div className="w-100 flex items-center justify-between px-4 py-3">
            {/* header */}
            <div className="flex flex-row items-center">
              {fullDictionary.previousWords &&
              fullDictionary.previousWords.length > 0 ? (
                <button
                  type="button"
                  className="h-8 w-9 overflow-hidden"
                  onClick={() => {
                    let history = fullDictionary.previousWords
                      ? [...fullDictionary.previousWords]
                      : [];
                    if (history.length > 0) {
                      if (history[history.length - 1] == "fullDict") {
                        history.pop();
                        fullDictionary.setPreviousWords(history);
                        fullDictionary.setWord(null);
                      } else {
                        // I get a warning with history.pop() here
                        // saying it could not be the word type
                        // but it must exist and not be "fullDict" at this point
                        // so it's probably fine?
                        const next = history.pop();
                        if (typeof next == "object") {
                          fullDictionary.setWord(next);
                        } else {
                          fullDictionary.setWord(null);
                        }

                        fullDictionary.setPreviousWords(history);
                      }
                    } else {
                      fullDictionary.setPreviousWords(history);
                    }
                    // if (history && history[history.length - 1 ] == "fullDict") {

                    //   history.pop();
                    //   fullDictionary.setPreviousWords(history)
                    //   fullDictionary.setWord(null);
                    //   return;

                    // } else if(history && history[history.length - 1]) {
                    //   fullDictionary.setWord(history[history.length - 1]);
                    // }
                    // fullDictionary.setPreviousWord(null);
                  }}
                >
                  <ArrowIcon className="h-full w-full object-fill" />{" "}
                  <span className="sr-only">Go Back</span>
                </button>
              ) : (
                <></>
              )}
              {/* {fullDictionary.word ? (
                <>
             
                  <button className="mx-8 -mt-16 h-36 w-16">
                    <BookmarkIcon className="h-full w-full first:fill-transparent" />
                    <span className="sr-only">Bookmark this word</span>
                  </button>
                </>
              ) : (
                <></>
              )} */}
              {fullDictionary.word ? (
                bookmark ? (
                  <button
                    onClick={async () => {
                      console.log("removing bookmark");
                      let copyDict = Object.assign(
                        {},
                        fullDictionary.dictionary,
                      );
                      if (fullDictionary.word?.word) {
                        copyDict[fullDictionary.word.word].bookmarked = false;
                        fullDictionary.setDictionary(copyDict);
                        setBookmark(false);
                      }
                    }}
                    type="button"
                    className="mx-8 -mt-16 h-36 w-16"
                  >
                    <BookmarkIcon className="h-full w-full first:fill-sciquelTeal" />
                    <span className="sr-only">Remove bookmark</span>
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      console.log("adding bookmark");
                      let copyDict = Object.assign(
                        {},
                        fullDictionary.dictionary,
                      );
                      if (fullDictionary.word?.word) {
                        copyDict[fullDictionary.word.word].bookmarked = true;
                        fullDictionary.setDictionary(copyDict);
                        setBookmark(true);
                      }
                    }}
                    type="button"
                    className="mx-8 -mt-16 h-36 w-16"
                  >
                    <BookmarkIcon className="h-full w-full first:fill-transparent" />
                    <span className="sr-only">Bookmark this word</span>
                  </button>
                )
              ) : (
                <></>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                fullDictionary.setOpen(false);
              }}
            >
              <Image
                className="opacity-75 hover:opacity-100"
                alt="close dictionary"
                src={closeButton}
                width={20}
                height={20}
              />
            </button>
          </div>
          <div className="flex-1 overflow-y-scroll">
            {fullDictionary.word?.word ? (
              <div className="px-4 py-2 font-sourceSerif4">
                <div className="border-b-2 border-sciquelTeal">
                  <p className="text-sciquelCitation ">Term</p>
                  <p className="relative mx-auto flex w-fit items-center pb-2 pt-3 text-center font-bold">
                    {fullDictionary.word.word}{" "}
                    <button type="button" className="relative left-2">
                      <Image
                        width={15}
                        height={15}
                        src={audioIcon}
                        alt="listen to pronounciation"
                      />
                    </button>
                  </p>

                  <p className="whitespace-pre-line pb-4 text-center">
                    {fullDictionary.word.pronunciation}
                  </p>
                </div>
                <p className="mt-2 text-sciquelCitation">
                  Definition
                  <button
                    type="button"
                    className="relative left-2 top-0.5 opacity-50"
                  >
                    <Image
                      width={15}
                      height={15}
                      src={audioIcon}
                      alt="listen to definition"
                    />
                  </button>
                </p>

                <p>{fullDictionary.word.definition}</p>

                <div className="my-2 w-2/5 border-b-2 border-sciquelTeal" />

                <p className="mt-2 text-sciquelCitation">In-Context</p>

                {fullDictionary.word.inContext.map((item, index) => (
                  <div className="my-2 flex flex-row" key={`${item}-${index}`}>
                    <p className="my-0 flex-1">{item}</p>
                    <button type="button" className="w-fit px-2">
                      <Image
                        width={15}
                        height={15}
                        src={audioIcon}
                        alt="listen to sentence"
                      />
                    </button>
                  </div>
                ))}
                <div className="my-2 w-2/5 border-b-2 border-sciquelTeal" />
                <p className="text-sciquelCitation">Instances</p>
                {Object.keys(fullDictionary.word.instances).map(
                  (item, index) => (
                    <button
                      type="button"
                      className="my-2 text-start"
                      key={item}
                      onClick={() => {
                        fullDictionary.word?.instances[item]?.scrollIntoView({
                          behavior: "instant",
                          block: "center",
                        });
                      }}
                    >
                      {item}
                    </button>
                  ),
                )}

                <div className="mx-auto my-2 w-1/5 border-b-2 border-sciquelTeal" />
                <button
                  type="button"
                  onClick={() => {
                    if (fullDictionary.word) {
                      if (fullDictionary.previousWords) {
                        // let newHistory = [...fullDictionary.previousWords];
                        // newHistory.push(fullDictionary.word);
                        fullDictionary.setPreviousWords([
                          ...fullDictionary.previousWords,
                          fullDictionary.word,
                        ]);
                      } else {
                        fullDictionary.setPreviousWords([fullDictionary.word]);
                      }
                    }

                    fullDictionary?.setWord(null);
                  }}
                  className="flex w-full items-center justify-center text-center font-sourceSerif4 text-sciquelCitation"
                >
                  See more definitions {">"}
                </button>
              </div>
            ) : (
              Object.keys(fullDictionary.dictionary).map((item, index) => {
                return (
                  <div
                    className="px-4 py-2 font-sourceSerif4"
                    key={`${item}-${index}`}
                  >
                    <p className="text-sciquelCitation">Term</p>
                    <button
                      type="button"
                      onClick={() => {
                        const copyWord = Object.assign(
                          {},
                          fullDictionary.dictionary[item],
                        ) as SelectedDefinition;
                        copyWord.word = item;

                        fullDictionary?.setWord(copyWord);

                        if (fullDictionary.previousWords) {
                          fullDictionary.setPreviousWords([
                            ...fullDictionary.previousWords,
                            "fullDict",
                          ]);
                        } else {
                          fullDictionary.setPreviousWords(["fullDict"]);
                        }
                      }}
                    >
                      {item}
                    </button>

                    <div className="mb-2 mt-1 w-2/5 border-b-2 border-sciquelTeal" />
                    <p className="text-sciquelCitation">Definition</p>
                    <p className="border-b-2 border-sciquelTeal py-2">
                      {fullDictionary.dictionary[item].definition}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            fullDictionary.setOpen(true);
            fullDictionary.setWord(null);
            fullDictionary.setPreviousWords([]);
          }}
          className="fixed bottom-0 right-0 mx-10 my-8 flex h-fit w-fit flex-row items-center rounded-full border-4 border-sciquelTeal bg-sciquelCardBg px-5 py-2"
        >
          {/* "open dictionary" floater */}
          <span className="font- alegreyaSansSC text-xl font-bold text-sciquelTeal">
            Dictionary
          </span>{" "}
          <DictionaryIcon className="ms-2 h-8 w-8" />
        </button>
      </>
    );
  }

  return <></>;
}
