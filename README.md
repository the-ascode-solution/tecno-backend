# Techno Tribe Backend

Backend server for the Techno Tribe survey application built with Express.js and MongoDB.

## 🚀 Features

- **Express.js Server**: Fast, unopinionated web framework
- **MongoDB Integration**: Cloud database with Mongoose ODM
- **CORS Support**: Cross-origin resource sharing for frontend integration
- **Security**: Helmet.js for security headers
- **Logging**: Morgan for HTTP request logging
- **Environment Variables**: Secure configuration management

## 📁 Project Structure

```
backend/
├── config/
│   └── database.js          # MongoDB connection configuration
├── models/
│   └── Survey.js           # Survey data model/schema
├── routes/
│   └── survey.js           # Survey API routes
├── .env                    # Environment variables (not in git)
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies and scripts
├── server.js              # Main server file
└── README.md              # This file
```

## 🛠️ Technology Stack

- **Node.js**: JavaScript runtime
- **Express.js**: Web application framework
- **MongoDB**: NoSQL database
- **Mongoose**: MongoDB object modeling
- **CORS**: Cross-origin resource sharing
- **Helmet**: Security middleware
- **Morgan**: HTTP request logger
- **dotenv**: Environment variable loader

## 🚀 Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn package manager
- MongoDB Atlas account (or local MongoDB instance)

### Installation

1. **Navigate to the backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file with your MongoDB connection string:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database-name
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   Or for production:
   ```bash
   npm start
   ```

The server will start on `http://localhost:3001`

## 📜 Available Scripts

### `npm start`
Runs the server in production mode.

### `npm run dev`
Runs the server in development mode with nodemon for auto-restart.

### `npm test`
Placeholder for future tests.

## 🔌 API Endpoints

### Survey Routes (`/api/survey`)

#### `POST /api/survey/submit`
Submit survey data to MongoDB.

**Request Body:**
```json
{
  "gender": "Male",
  "yearOfStudy": "3rd Year",
  "fieldOfStudy": "Computer Science",
  "university": "University Name",
  "socialMediaPlatforms": ["Instagram", "TikTok"],
  "timeSpentOnSocialMedia": "2-4 hours",
  "followsTechContent": "Yes",
  "techUpdateSources": ["YouTube", "Tech Blogs"],
  "currentPhoneBrand": "Samsung",
  "topPhoneFunctions": ["Camera", "Gaming"],
  "phoneChangeFrequency": "Every 2 years",
  "tecnoExperience": "Never used",
  "tecnoExperienceRating": "",
  "learningSkills": ["Programming", "Design"],
  "partTimeWork": ["Freelancing"],
  "phoneFeaturesRanking": ["Camera", "Battery", "Performance"],
  "phoneBudget": "₹15,000 - ₹25,000",
  "preferredPhoneColors": ["Black", "Blue"],
  "interestedInAmbassador": true,
  "ambassadorStrengths": ["Social Media", "Leadership"],
  "ambassadorBenefits": ["Free Products", "Networking"],
  "name": "John Doe",
  "contactNumber": "+1234567890",
  "socialMediaLink": "https://instagram.com/johndoe",
  "followerCount": "1000-5000",
  "suggestions": "Great survey!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Survey submitted successfully",
  "data": {
    "id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "submittedAt": "2023-09-06T10:30:00.000Z"
  }
}
```

#### `GET /api/survey/stats`
Get survey statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSurveys": 150,
    "ambassadorInterest": 45,
    "universityStats": [
      { "_id": "MIT", "count": 25 },
      { "_id": "Stanford", "count": 20 }
    ]
  }
}
```

#### `GET /api/survey/recent?limit=10`
Get recent survey submissions.

**Query Parameters:**
- `limit` (optional): Number of recent surveys to return (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "name": "John Doe",
      "university": "MIT",
      "submittedAt": "2023-09-06T10:30:00.000Z"
    }
  ]
}
```

### Health Check

#### `GET /health`
Server health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2023-09-06T10:30:00.000Z",
  "uptime": 3600
}
```

## 🔒 Security Features

- **Helmet.js**: Sets various HTTP headers to help protect the app
- **CORS**: Configured to allow requests from the frontend
- **Input Validation**: Mongoose schema validation
- **Error Handling**: Comprehensive error handling middleware
- **Environment Variables**: Sensitive data stored in environment variables

## 🗄️ Database Schema

The survey data is stored in MongoDB with the following structure:

- **Basic Information**: Gender, year of study, field of study, university
- **Social Media Habits**: Platforms used, time spent, tech content following
- **Mobile Phone Usage**: Current brand, top functions, change frequency
- **Skills & Work**: Learning skills, part-time work
- **Phone Preferences**: Feature rankings, budget, preferred colors
- **Ambassador Program**: Interest, strengths, benefits, contact info
- **Suggestions**: Free-form text feedback
- **Metadata**: Submission timestamp, IP address, user agent

## 🌐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | Required |
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment (development/production) | development |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:3000 |

## 🚀 Deployment

### MongoDB Atlas Setup

1. Create a MongoDB Atlas account
2. Create a new cluster
3. Create a database user
4. Whitelist your IP address
5. Get the connection string
6. Update the `MONGODB_URI` in your `.env` file

### Production Deployment

1. Set `NODE_ENV=production`
2. Update `FRONTEND_URL` to your production frontend URL
3. Use a process manager like PM2
4. Set up proper logging and monitoring

## 📝 Notes

- The server automatically adds metadata (IP address, user agent, timestamp) to each survey submission
- All survey fields are optional to allow partial submissions
- The database includes indexes for better query performance
- CORS is configured to work with the React frontend
- Error handling includes both development and production modes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.


