import multer from 'multer'


// configuration for disk storage
const storage = multer.diskStorage({
    filename: function(req,file,callback) {
        callback(null,file.originalname)
    }
})

// Instance of multer using diskStorage
const upload = multer({storage})

export default upload