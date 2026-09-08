import type { Review, InspirationImage } from "./types";

export const REVIEWS: Review[] = [
  {
    id: "r1",
    author: "Аньяа Петрова",
    avatar: "https://i.pravatar.cc/120?img=47",
    rating: 5,
    title: "Өрөөний төлөвлөгч миний орон сууцыг аварсан",
    body: "Худалдаж авахын өмнө гурван өөр байрлуулалтыг туршиж үзсэн. Халден буйдан яг таарсан — байрлуулсан газартаа тохирсон.",
    date: "2 долоо хоногийн өмнө",
    productName: "Халден гурван хүний буйдан",
  },
  {
    id: "r2",
    author: "Маркус Ли",
    avatar: "https://i.pravatar.cc/120?img=12",
    rating: 5,
    title: "Материалын чанар үнэхээр гайхалтай",
    body: "Фьорд ширээний хушга мод бодит байдалд маш үзэсгэлэнтэй. 3D загвар нь модны ширхэглэлийг хүртэл үнэн зөв харуулсан.",
    date: "1 сарын өмнө",
    productName: "Фьорд сунадаг хоолны ширээ",
  },
  {
    id: "r3",
    author: "Прия Раман",
    avatar: "https://i.pravatar.cc/120?img=32",
    rating: 4,
    title: "Амралтын өдрөөр оффисоо тохижуулсан",
    body: "Студио ширээ, Эрго сандал хурдан хүрч ирээд цаг хүрэхгүй угсарсан. Нуруу минь аль хэдийн сайжирсан.",
    date: "3 долоо хоногийн өмнө",
    productName: "Студио царс модон ширээ",
  },
  {
    id: "r4",
    author: "Хиро Танака",
    avatar: "https://i.pravatar.cc/120?img=68",
    rating: 5,
    title: "Дөрвөн өөр байрлуулалтыг харьцуулсан",
    body: "Харьцуулах функц үнэхээр хэрэгтэй. Бид гурав дахь сонголтыг сонгосон, зочны өрөө маань төгс болсон.",
    date: "5 өдрийн өмнө",
  },
];

export const INSPIRATION: InspirationImage[] = [
  {
    id: "i1",
    src: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80",
    title: "Зөөлөн минимализм",
    style: "Скандинав",
  },
  {
    id: "i2",
    src: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=80",
    title: "Дулаан орчин үе",
    style: "Дунд зуун",
  },
  {
    id: "i3",
    src: "https://images.unsplash.com/photo-1567016526105-22da7c13161a?auto=format&fit=crop&w=900&q=80",
    title: "Чимээгүй номын сан",
    style: "Сонгодог",
  },
  {
    id: "i4",
    src: "https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=900&q=80",
    title: "Газрын өнгө",
    style: "Жапанди",
  },
  {
    id: "i5",
    src: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=900&q=80",
    title: "Лофт амьдрал",
    style: "Үйлдвэрлэлийн",
  },
];

export const STORE_LOCATIONS = [
  {
    city: "Улаанбаатар",
    address: "СБД, 1-р хороо, Сүхбаатарын талбай 3",
    phone: "+976 7711 0142",
    hours: "Дав–Бям 10–20 · Ням 11–18",
  },
  {
    city: "Дархан",
    address: "Дархан-Уул, 4-р баг, Их дэлгүүрийн зүүн талд",
    phone: "+976 7037 0188",
    hours: "Дав–Бям 10–19",
  },
  {
    city: "Эрдэнэт",
    address: "Орхон аймаг, Баянгол дүүрэг, Сансарын гудамж 12",
    phone: "+976 7035 0142",
    hours: "Мяг–Бям 10–18",
  },
  {
    city: "Токио",
    address: "5-10-1 Широканэдай, Минато-ку, Токио",
    phone: "+81 3 5555 0142",
    hours: "Дав–Ням 11–20",
  },
];
